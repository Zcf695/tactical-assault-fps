/**
 * world_polish.js
 * 场景细节增强 —— 接地感与环境层次
 *
 * 解决的问题：
 * 现有地图的箱体、建筑、掩体直接“坐”在地面上，缺少接触阴影，
 * 在俯视/斜视角下会显得漂浮，这是低多边形场景最容易暴露廉价感的地方。
 *
 * 做法（参考 3A 作品的 baked AO 贴片思路，但保持零资源依赖）：
 * - 用一张程序化径向渐变贴图作为软阴影
 * - 所有静态障碍物合并到一个 InstancedMesh（单次 draw call）
 * - 阴影只贴地、不写深度、不投影，不影响玩法与碰撞
 * - 树木用树冠半径生成椭圆阴影，避免“锥体悬空”
 *
 * 用法：
 *   WorldPolish.apply(mapEnvironmentGroup, obstacles)  // 地图构建完成后
 *   WorldPolish.clear()                                // 切图前
 */

const WorldPolish = (function () {
    let _shadowMesh = null;
    let _shadowTexture = null;
    let _parent = null;

    const SHADOW_Y = 0.055;

    /**
     * 软阴影贴图：中心深、边缘透明的径向渐变。
     * 不依赖外部图片，避免额外网络请求与跨域问题。
     */
    function _getShadowTexture() {
        if (_shadowTexture) return _shadowTexture;
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0.00, 'rgba(0,0,0,0.55)');
        g.addColorStop(0.45, 'rgba(0,0,0,0.38)');
        g.addColorStop(0.72, 'rgba(0,0,0,0.16)');
        g.addColorStop(1.00, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        _shadowTexture = tex;
        return tex;
    }

    /** 收集需要接地阴影的静态物体尺寸信息 */
    function _collectFootprints(env, obstacles) {
        const list = [];
        const seen = new Set();

        const push = (x, z, w, d, strength) => {
            if (!isFinite(x) || !isFinite(z) || !isFinite(w) || !isFinite(d)) return;
            if (w < 0.45 || d < 0.45) return;
            list.push({ x: x, z: z, w: w, d: d, strength: strength == null ? 1 : strength });
        };

        // 1) 有碰撞体的静态物：建筑、集装箱、掩体、油桶、栅栏
        for (const o of (obstacles || [])) {
            if (!o || o.isWater || !o.mesh) continue;
            if (seen.has(o.mesh)) continue;
            seen.add(o.mesh);

            const p = o.mesh.position;
            if (o.isAABB && o.halfW && o.halfD) {
                // 大建筑由真实太阳阴影负责；这里只补小型物体的接触阴影，避免出现巨大黑块
                if (o.halfW * 2 > 14 || o.halfD * 2 > 14) continue;
                // 栅栏很薄，给一个最小宽度避免阴影退化成一条线
                push(p.x, p.z, Math.max(o.halfW * 2.5, 0.8), Math.max(o.halfD * 2.5, 0.8), 0.95);
            } else if (o.radius) {
                const r = o.radius * 2.6;
                push(p.x, p.z, r, r, 0.9);
            }
        }

        // 2) 树木：锥形树冠本身没有碰撞体，单独按几何参数补
        if (env) {
            env.traverse(function (child) {
                if (!child.isMesh || !child.geometry) return;
                if (child.geometry.type !== 'ConeGeometry') return;
                const parent = child.parent;
                if (!parent || seen.has(parent)) return;
                seen.add(parent);
                const r = (child.geometry.parameters && child.geometry.parameters.radius) || 1;
                const size = Math.max(1.2, r * 2.2);
                push(parent.position.x, parent.position.z, size, size, 0.75);
            });
        }

        return list;
    }

    function clear() {
        if (_shadowMesh) {
            if (_shadowMesh.parent) _shadowMesh.parent.remove(_shadowMesh);
            _shadowMesh.geometry.dispose();
            _shadowMesh.material.dispose();
            _shadowMesh = null;
        }
        _parent = null;
    }

    // ============================================================
    // 静态合批
    // ============================================================

    /** 材质签名：只有外观完全一致（含贴图与 repeat）的网格才能合并 */
    function _materialKey(m) {
        if (!m || Array.isArray(m) || m.isShaderMaterial) return null;
        const map = m.map;
        return [
            m.type,
            m.color ? m.color.getHexString() : '',
            m.roughness != null ? m.roughness.toFixed(2) : '',
            m.metalness != null ? m.metalness.toFixed(2) : '',
            m.emissive ? m.emissive.getHexString() : '',
            m.emissiveIntensity != null ? m.emissiveIntensity.toFixed(2) : '',
            m.opacity != null ? m.opacity.toFixed(2) : '',
            m.side,
            map ? map.uuid : '',
            map ? map.repeat.x.toFixed(2) + 'x' + map.repeat.y.toFixed(2) : '',
            map && 'encoding' in map ? map.encoding : '',
        ].join('|');
    }

    /**
     * 将若干 BufferGeometry 按世界矩阵烘焙成一个几何体。
     * 只处理 position/normal/uv + index，覆盖场景中全部标准几何体。
     */
    function _mergeMeshes(meshes) {
        let vCount = 0, iCount = 0;
        for (const mesh of meshes) {
            const g = mesh.geometry;
            if (!g || !g.attributes || !g.attributes.position) continue;
            const n = g.attributes.position.count;
            vCount += n;
            iCount += g.index ? g.index.count : n;
        }
        if (vCount === 0) return null;

        const positions = new Float32Array(vCount * 3);
        const normals = new Float32Array(vCount * 3);
        const uvs = new Float32Array(vCount * 2);
        const indices = new Uint32Array(iCount);

        const v3 = new THREE.Vector3();
        const n3 = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3();
        let vOff = 0, iOff = 0, posOff = 0;

        for (const mesh of meshes) {
            const g = mesh.geometry;
            if (!g || !g.attributes || !g.attributes.position) continue;
            const pos = g.attributes.position;
            const nor = g.attributes.normal;
            const uv = g.attributes.uv;
            const idx = g.index;

            mesh.updateWorldMatrix(true, false);
            const mat = mesh.matrixWorld;
            normalMatrix.getNormalMatrix(mat);

            for (let i = 0; i < pos.count; i++) {
                v3.fromBufferAttribute(pos, i).applyMatrix4(mat);
                positions[posOff] = v3.x;
                positions[posOff + 1] = v3.y;
                positions[posOff + 2] = v3.z;

                if (nor) {
                    n3.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
                    normals[posOff] = n3.x;
                    normals[posOff + 1] = n3.y;
                    normals[posOff + 2] = n3.z;
                }

                if (uv) {
                    uvs[(vOff + i) * 2] = uv.getX(i);
                    uvs[(vOff + i) * 2 + 1] = uv.getY(i);
                }
                posOff += 3;
            }

            if (idx) {
                for (let i = 0; i < idx.count; i++) indices[iOff + i] = idx.getX(i) + vOff;
                iOff += idx.count;
            } else {
                for (let i = 0; i < pos.count; i++) indices[iOff + i] = i + vOff;
                iOff += pos.count;
            }
            vOff += pos.count;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(new THREE.BufferAttribute(indices, 1));
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        return geo;
    }

    /**
     * 静态合批：把同材质的小网格合并成一个几何体，原网格只做隐藏保留。
     *
     * 为什么保留原网格：
     * - 玩家射击用 obstacles.map(o => o.mesh) 做射线检测，隐藏对象仍可被 Raycaster 命中；
     * - 解锁动画、水面、区域提示等动态对象通过 noBatch / transparent 排除。
     *
     * @param {THREE.Group} env
     * @returns {{before:number, after:number, merged:number}}
     */
    function batchStatic(env) {
        if (!env) return { before: 0, after: 0, merged: 0 };

        const groups = new Map();
        const meshes = [];
        env.traverse(function (o) {
            if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
            if (!o.visible) return;
            if (o.userData && o.userData.noBatch) return;
            if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
            if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
            const mat = o.material;
            if (!mat || Array.isArray(mat)) return;
            // 透明物体（水面、区域提示）保留独立绘制，避免打乱混合顺序
            if (mat.transparent || mat.depthWrite === false) return;
            const key = _materialKey(mat);
            if (!key) return;

            const fullKey = key + '|s' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
            if (!groups.has(fullKey)) groups.set(fullKey, []);
            groups.get(fullKey).push(o);
            meshes.push(o);
        });

        let mergedCount = 0;
        let createdCount = 0;
        groups.forEach(function (list) {
            if (list.length < 2) return;
            const geo = _mergeMeshes(list);
            if (!geo) return;
            const src = list[0];
            const mesh = new THREE.Mesh(geo, src.material);
            mesh.castShadow = src.castShadow;
            mesh.receiveShadow = src.receiveShadow;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            mesh.userData.isBatchedStatic = true;
            env.add(mesh);

            for (const o of list) o.visible = false;
            mergedCount += list.length;
            createdCount++;
        });

        const after = meshes.length - mergedCount + createdCount;
        console.log('[WorldPolish] 静态合批: ' + meshes.length + ' 个网格 → ' + after +
            ' 个可见对象（合并 ' + mergedCount + ' 个到 ' + createdCount + ' 个批次）');
        return { before: meshes.length, after: after, merged: mergedCount };
    }

    /**
     * 构建/重建接地阴影层。
     * @param {THREE.Group} env 地图环境组
     * @param {Array} obstacles 现有的碰撞体列表（复用其位置与尺寸）
     */
    function apply(env, obstacles) {
        clear();
        if (!env || typeof THREE === 'undefined') return;

        const list = _collectFootprints(env, obstacles);
        if (list.length === 0) return;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            map: _getShadowTexture(),
            color: 0x000000,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            toneMapped: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
        });

        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        mesh.name = 'contactShadows';
        mesh.renderOrder = 2;
        mesh.frustumCulled = false; // 实例分布覆盖整张地图，整体不做剔除
        mesh.userData.isContactShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < list.length; i++) {
            const f = list[i];
            dummy.position.set(f.x, SHADOW_Y, f.z);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.scale.set(f.w, f.d, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;

        env.add(mesh);
        _shadowMesh = mesh;
        _parent = env;
    }

    return { apply, clear, batchStatic };
})();
