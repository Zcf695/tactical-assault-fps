/**
 * enemy_ai.js
 * 敌人AI增强模块 —— 多样化攻击模式、移动路径、交互反应
 * 
 * 新增敌人类型：
 * - scout(侦察兵): 巡逻范围大，保持距离射击，会侧翼包抄
 * - rifleman(步枪手): 中距离点射，会找掩体
 * - commander(指挥官): 高伤害全自动，会呼叫增援
 * - sniper(狙击手): 远距离精准射击，保持距离
 * - rusher(冲锋兵): 快速近战冲锋，投掷手雷
 * 
 * 新增状态：search(搜索)、flank(侧翼)、take_cover(掩体)、retreat(撤退)、melee(近战)、dying(死亡)
 */

const EnemyAI = (function () {
    let _grenades = []; // 场景中的手雷

    // ========== 辅助函数 ==========

    /** 找最近的掩体位置 */
    function findNearestCover(fromPos, playerPos) {
        let best = null;
        let bestDist = Infinity;
        // 利用障碍物作为掩体
        for (const o of obstacles) {
            if (!o.isAABB) continue;
            const ox = o.mesh.position.x, oz = o.mesh.position.z;
            // 掩体应该在敌人和玩家之间，且离敌人较近
            const dEnemy = Math.hypot(ox - fromPos.x, oz - fromPos.z);
            const dPlayer = Math.hypot(ox - playerPos.x, oz - playerPos.z);
            if (dEnemy < 15 && dEnemy < dPlayer && dEnemy > 2) {
                if (dEnemy < bestDist) {
                    bestDist = dEnemy;
                    best = { x: ox, z: oz };
                }
            }
        }
        // 如果没有合适的障碍物，找地图边缘或建筑
        if (!best) {
            for (const b of FIXED_BUILDINGS) {
                const bx = b.x, bz = b.z;
                const d = Math.hypot(bx - fromPos.x, bz - fromPos.z);
                if (d < 20 && d > 3) {
                    // 找建筑侧面（远离玩家的一侧）
                    const angle = Math.atan2(fromPos.z - bz, fromPos.x - bx);
                    best = { x: bx + Math.cos(angle) * (b.w / 2 + 1), z: bz + Math.sin(angle) * (b.d / 2 + 1) };
                    break;
                }
            }
        }
        return best;
    }

    /** 投掷手雷 */
    function throwGrenade(enemy, targetPos) {
        if (enemy.grenades <= 0) return false;
        enemy.grenades--;
        const startPos = new THREE.Vector3(enemy.mesh.position.x, 1.4, enemy.mesh.position.z);
        const target = new THREE.Vector3(targetPos.x, 0, targetPos.z);
        const dir = target.clone().sub(startPos).normalize();
        const dist = startPos.distanceTo(target);
        const speed = Math.max(8, dist * 0.8);

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x2a4a2a, metalness: 0.6, roughness: 0.4 })
        );
        mesh.position.copy(startPos);
        scene.add(mesh);

        _grenades.push({
            mesh: mesh,
            velocity: new THREE.Vector3(dir.x * speed, 6 + dist * 0.15, dir.z * speed),
            life: 2.5,
            damage: enemy.damage * 1.5,
            radius: 4,
        });
        return true;
    }

    /** 更新手雷 */
    function updateGrenades(dt) {
        for (let i = _grenades.length - 1; i >= 0; i--) {
            const g = _grenades[i];
            g.life -= dt;
            g.velocity.y -= 18 * dt; // 重力
            g.mesh.position.addScaledVector(g.velocity, dt);
            // 地面反弹
            if (g.mesh.position.y < 0.1) {
                g.mesh.position.y = 0.1;
                g.velocity.y *= -0.4;
                g.velocity.x *= 0.7;
                g.velocity.z *= 0.7;
            }
            // 爆炸
            if (g.life <= 0) {
                explodeGrenade(g);
                scene.remove(g.mesh);
                g.mesh.geometry.dispose();
                g.mesh.material.dispose();
                _grenades.splice(i, 1);
            }
        }
    }

    /** 手雷爆炸 */
    function explodeGrenade(g) {
        // 爆炸特效
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(g.radius, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
        );
        flash.position.copy(g.mesh.position);
        scene.add(flash);
        particles.push({ mesh: flash, velocity: new THREE.Vector3(), life: 15, maxLife: 15, type: 'flash' });

        // 爆炸粒子
        for (let i = 0; i < 12; i++) {
            const p = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 4, 4),
                new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4400 : 0xffaa00, transparent: true, opacity: 1 })
            );
            p.position.copy(g.mesh.position);
            scene.add(p);
            particles.push({
                mesh: p,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4),
                life: 25, maxLife: 25, type: 'hit'
            });
        }

        // 伤害玩家
        const dx = playerGroup.position.x - g.mesh.position.x;
        const dz = playerGroup.position.z - g.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < g.radius) {
            const dmg = Math.round(g.damage * (1 - dist / g.radius));
            damagePlayer(dmg);
            // 屏幕震动
            if (typeof screenShake === 'function') screenShake(0.3);
        }
    }

    /** 敌人受击反应 */
    function onEnemyHit(enemy, damage) {
        enemy.hitReactTimer = 0.15;
        // 受击时身体轻微闪烁
        const body = enemy.mesh.getObjectByName('body');
        if (body) {
            const origColor = body.material.color.getHex();
            body.material.color.setHex(0xff6666);
            setTimeout(() => { if (body) body.material.color.setHex(origColor); }, 100);
        }
        // 低血量撤退
        if (enemy.health < enemy.maxHealth * 0.25 && enemy.enemyLevel >= 2 && enemy.state !== 'retreat') {
            enemy.state = 'retreat';
            enemy.alertTimer = 3;
        }
    }

    /** 敌人死亡动画 */
    function startDeathAnimation(enemy) {
        if (enemy.isDying) return;
        enemy.isDying = true;
        enemy.deathTimer = 1.2;
        enemy.state = 'dying';
        // 倒地动画：身体旋转倒下
        enemy.mesh.userData.deathAngle = 0;
        enemy.mesh.userData.deathDir = Math.random() < 0.5 ? 1 : -1;
    }

    /** 更新死亡动画 */
    function updateDeathAnimation(enemy, dt) {
        enemy.deathTimer -= dt;
        const progress = 1 - enemy.deathTimer / 1.2;
        // 身体向前/向后倒下
        enemy.mesh.rotation.x = progress * Math.PI / 2 * enemy.mesh.userData.deathDir;
        enemy.mesh.position.y = -progress * 0.3;
        // 血条渐隐
        const hb = enemy.mesh.getObjectByName('healthBar');
        if (hb) hb.material.opacity = 1 - progress;
        const hbBg = enemy.mesh.children.find(c => c.geometry && c.geometry.type === 'PlaneGeometry' && c.name !== 'healthBar');
        if (hbBg) hbBg.material.opacity = 1 - progress;
    }

    /** 呼叫增援 */
    function callReinforcements(enemy) {
        if (enemy.callReinforcementsCooldown > 0) return false;
        enemy.callReinforcementsCooldown = 30;
        // 生成1-2个低级敌人
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            // 在敌人附近生成
            const angle = Math.random() * Math.PI * 2;
            const dist = 5 + Math.random() * 5;
            const ox = enemy.mesh.position.x + Math.cos(angle) * dist;
            const oz = enemy.mesh.position.z + Math.sin(angle) * dist;
            // 临时修改 createEnemy 的生成位置比较复杂，这里直接调用 createEnemy 让它随机生成
            createEnemy();
        }
        showFloatingMsg('敌方增援已到达！');
        return true;
    }

    /** 敌人近战攻击 */
    function enemyMeleeAttack(enemy) {
        if (enemy.meleeCooldown > 0) return;
        enemy.meleeCooldown = 1.0;
        const dist = Math.hypot(
            playerGroup.position.x - enemy.mesh.position.x,
            playerGroup.position.z - enemy.mesh.position.z
        );
        if (dist < 2.0) {
            damagePlayer(Math.round(enemy.damage * 0.8));
            // 近战挥砍动画
            const rArm = enemy.mesh.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.x > 0.2);
            if (rArm) {
                rArm.rotation.x = -1.2;
                setTimeout(() => { if (rArm) rArm.rotation.x = -0.5; }, 200);
            }
        }
    }

    // ========== 主更新函数（替代原updateEnemies的核心逻辑） ==========

    function updateEnemyAI(enemy, dt, now) {
        const isHard = S.mode === 'hard';
        let detectRange = isHard ? 35 : 28;
        // 技能效果：静音步伐（减少敌人侦测范围）
        if (typeof getPlayerNoiseReduction === 'function') {
            const noiseReduction = getPlayerNoiseReduction();
            detectRange *= Math.max(0.5, 1.0 - noiseReduction);
        }
        const alertTime = isHard ? 6 : 4;

        const dx = playerGroup.position.x - enemy.mesh.position.x;
        const dz = playerGroup.position.z - enemy.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // 视线 8Hz 足够：缓存结果，避免每帧对全部掩体求交
        if (!enemy._losNext || now >= enemy._losNext) {
            enemy._los = hasLineOfSight(enemy, playerGroup.position);
            enemy._losNext = now + 120;
        }
        const hasLOS = enemy._los;

        // 计时器更新
        if (enemy.hitReactTimer > 0) enemy.hitReactTimer -= dt;
        if (enemy.callReinforcementsCooldown > 0) enemy.callReinforcementsCooldown -= dt;
        if (enemy.meleeCooldown > 0) enemy.meleeCooldown -= dt;
        if (enemy.burstTimer > 0) enemy.burstTimer -= dt;
        if (enemy.strafeTimer > 0) {
            enemy.strafeTimer -= dt;
            if (enemy.strafeTimer <= 0) enemy.strafeDir *= -1;
        }

        // 死亡动画
        if (enemy.isDying) {
            updateDeathAnimation(enemy, dt);
            return;
        }

        // 受击反应（短暂停顿）
        if (enemy.hitReactTimer > 0) return;

        // === 状态转换逻辑 ===
        if (hasLOS && dist < detectRange) {
            // 发现玩家
            enemy.lastKnownPos = { x: playerGroup.position.x, z: playerGroup.position.z };
            enemy.alertTimer = alertTime;
            enemy.lostSightTimer = 0;
            enemy.searchTimer = 0;

            if (enemy.health < enemy.maxHealth * 0.2 && enemy.enemyLevel >= 2) {
                enemy.state = 'retreat';
            } else if (enemy.enemyType === 'rusher' && dist < 8) {
                enemy.state = 'melee';
            } else if (enemy.enemyType === 'sniper' && dist < 12) {
                enemy.state = 'retreat'; // 狙击手保持距离
            } else if (dist < enemy.attackRange) {
                enemy.state = 'attack';
            } else if (enemy.enemyType === 'scout' && dist < 20 && Math.random() < 0.01) {
                enemy.state = 'flank'; // 侦察兵偶尔侧翼
            } else {
                enemy.state = 'chase';
            }
        } else if (enemy.alertTimer > 0) {
            enemy.alertTimer -= dt;
            if (enemy.lastKnownPos) {
                const ldx = enemy.lastKnownPos.x - enemy.mesh.position.x;
                const ldz = enemy.lastKnownPos.z - enemy.mesh.position.z;
                const ldist = Math.hypot(ldx, ldz);
                if (ldist < 3) {
                    enemy.state = 'search';
                    enemy.searchTimer = 4;
                } else {
                    enemy.state = 'chase';
                }
            } else {
                enemy.state = 'chase';
            }
        } else if (enemy.state === 'search' && enemy.searchTimer > 0) {
            enemy.searchTimer -= dt;
            if (enemy.searchTimer <= 0) {
                enemy.state = 'patrol';
                enemy.lastKnownPos = null;
            }
        } else {
            enemy.state = 'patrol';
        }

        // === 状态行为 ===
        switch (enemy.state) {
            case 'chase':
            case 'attack':
                doCombatBehavior(enemy, dt, now, dx, dz, dist, hasLOS);
                break;

            case 'search':
                doSearchBehavior(enemy, dt);
                break;

            case 'flank':
                doFlankBehavior(enemy, dt, dx, dz, dist);
                break;

            case 'retreat':
                doRetreatBehavior(enemy, dt, dx, dz, dist);
                break;

            case 'melee':
                doMeleeBehavior(enemy, dt, dx, dz, dist);
                break;

            case 'patrol':
            default:
                doPatrolBehavior(enemy, dt);
                break;
        }

        // 边界限制
        const hb2 = CONFIG.mapSize / 2 - 4;
        enemy.mesh.position.x = Math.max(-hb2, Math.min(hb2, enemy.mesh.position.x));
        enemy.mesh.position.z = Math.max(-hb2, Math.min(hb2, enemy.mesh.position.z));

        // 血条朝向相机
        const hbF = enemy.mesh.getObjectByName('healthBar');
        if (hbF) hbF.lookAt(camera.position);
    }

    /** 战斗行为（追击+攻击） */
    function doCombatBehavior(enemy, dt, now, dx, dz, dist, hasLOS) {
        const type = enemy.enemyType;

        // 移动逻辑
        let moveX = 0, moveZ = 0;
        let shouldMove = false;

        if (type === 'sniper') {
            // 狙击手：保持远距离，太近就后退
            if (dist < 15) {
                moveX = -dx / dist; moveZ = -dz / dist; shouldMove = true;
            } else if (dist > enemy.attackRange * 0.9) {
                moveX = dx / dist; moveZ = dz / dist; shouldMove = true;
            }
        } else if (type === 'rusher') {
            // 冲锋兵：一直冲
            if (dist > 2) {
                moveX = dx / dist; moveZ = dz / dist; shouldMove = true;
            }
        } else {
            // 普通：接近到攻击距离的75%
            if (dist > enemy.attackRange * 0.75) {
                moveX = dx / dist; moveZ = dz / dist; shouldMove = true;
            } else if (dist < enemy.attackRange * 0.3 && type !== 'commander') {
                // 太近就后退（除了指挥官）
                moveX = -dx / dist; moveZ = -dz / dist; shouldMove = true;
            }
        }

        // 侧移（步枪手和侦察兵会左右移动规避）
        if ((type === 'rifleman' || type === 'scout') && dist < enemy.attackRange && hasLOS) {
            if (enemy.strafeTimer <= 0) enemy.strafeTimer = 1.5 + Math.random();
            const perpX = -dz / dist, perpZ = dx / dist;
            moveX += perpX * enemy.strafeDir * 0.5;
            moveZ += perpZ * enemy.strafeDir * 0.5;
            shouldMove = true;
        }

        if (shouldMove) {
            const len = Math.hypot(moveX, moveZ);
            if (len > 0) {
                moveX /= len; moveZ /= len;
                const speed = enemy.speed * (type === 'rusher' ? 1.3 : 1) * dt;
                const nx = enemy.mesh.position.x + moveX * speed;
                const nz = enemy.mesh.position.z + moveZ * speed;
                if (!isEnemyBlocked(nx, nz)) {
                    enemy.mesh.position.x = nx;
                    enemy.mesh.position.z = nz;
                }
            }
        }

        // 朝向玩家
        enemy.mesh.rotation.y = Math.atan2(dx, dz);

        // 攻击逻辑
        if (dist < enemy.attackRange && hasLOS && now - enemy.lastAttack > enemy.attackCd) {
            // 不同类型的攻击模式
            if (type === 'sniper') {
                // 狙击手：高伤害单发，长冷却
                enemy.lastAttack = now;
                enemyShoot(enemy, 0.015); // 极小散射
            } else if (type === 'commander') {
                // 指挥官：全自动3连发
                enemy.lastAttack = now;
                enemy.burstCount = 3;
                enemy.burstTimer = 0;
            } else if (type === 'rifleman') {
                // 步枪手：2连发点射
                enemy.lastAttack = now;
                enemy.burstCount = 2;
                enemy.burstTimer = 0;
            } else if (type === 'rusher' && dist < 5 && enemy.grenades > 0 && Math.random() < 0.3) {
                // 冲锋兵近距离扔手雷
                enemy.lastAttack = now + 1; // 扔手雷后较长冷却
                throwGrenade(enemy, { x: playerGroup.position.x, z: playerGroup.position.z });
            } else {
                // 侦察兵：普通射击
                enemy.lastAttack = now;
                enemyShoot(enemy, 0.08);
            }
        }

        // 处理连发
        if (enemy.burstCount > 0 && enemy.burstTimer <= 0) {
            enemyShoot(enemy, type === 'commander' ? 0.06 : 0.04);
            enemy.burstCount--;
            enemy.burstTimer = 0.12;
        }

        // 指挥官呼叫增援
        if (type === 'commander' && enemy.health < enemy.maxHealth * 0.5 && enemy.callReinforcementsCooldown <= 0) {
            callReinforcements(enemy);
        }
    }

    /** 搜索行为 */
    function doSearchBehavior(enemy, dt) {
        if (!enemy.lastKnownPos) { enemy.state = 'patrol'; return; }
        const ldx = enemy.lastKnownPos.x - enemy.mesh.position.x;
        const ldz = enemy.lastKnownPos.z - enemy.mesh.position.z;
        const ldist = Math.hypot(ldx, ldz);
        if (ldist > 2) {
            const sp = enemy.speed * 0.6 * dt;
            enemy.mesh.position.x += ldx / ldist * sp;
            enemy.mesh.position.z += ldz / ldist * sp;
            enemy.mesh.rotation.y = Math.atan2(ldx, ldz);
        } else {
            // 到达后原地环顾
            enemy.mesh.rotation.y += dt * 1.5;
        }
    }

    /** 侧翼行为 */
    function doFlankBehavior(enemy, dt, dx, dz, dist) {
        // 垂直于玩家方向移动
        const perpX = -dz / dist, perpZ = dx / dist;
        const sp = enemy.speed * 0.8 * dt;
        const nx = enemy.mesh.position.x + perpX * enemy.strafeDir * sp;
        const nz = enemy.mesh.position.z + perpZ * enemy.strafeDir * sp;
        if (!isEnemyBlocked(nx, nz)) {
            enemy.mesh.position.x = nx;
            enemy.mesh.position.z = nz;
        } else {
            enemy.strafeDir *= -1;
        }
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        // 侧翼一段时间后回到追击
        if (enemy.strafeTimer <= 0) {
            enemy.strafeTimer = 2 + Math.random() * 2;
            enemy.state = 'chase';
        }
    }

    /** 撤退行为 */
    function doRetreatBehavior(enemy, dt, dx, dz, dist) {
        // 远离玩家
        const sp = enemy.speed * 1.2 * dt;
        const nx = enemy.mesh.position.x - dx / dist * sp;
        const nz = enemy.mesh.position.z - dz / dist * sp;
        if (!isEnemyBlocked(nx, nz)) {
            enemy.mesh.position.x = nx;
            enemy.mesh.position.z = nz;
        }
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        // 撤退时偶尔回头射击
        if (dist < enemy.attackRange && Math.random() < 0.02) {
            enemyShoot(enemy, 0.12);
        }
        // 血量恢复一点后回到追击
        if (enemy.health > enemy.maxHealth * 0.4 || enemy.alertTimer <= 0) {
            enemy.state = 'chase';
        }
    }

    /** 近战行为 */
    function doMeleeBehavior(enemy, dt, dx, dz, dist) {
        if (dist > 2) {
            const sp = enemy.speed * 1.4 * dt;
            const nx = enemy.mesh.position.x + dx / dist * sp;
            const nz = enemy.mesh.position.z + dz / dist * sp;
            if (!isEnemyBlocked(nx, nz)) {
                enemy.mesh.position.x = nx;
                enemy.mesh.position.z = nz;
            }
        }
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        enemyMeleeAttack(enemy);
    }

    /** 巡逻行为 */
    function doPatrolBehavior(enemy, dt) {
        const tdx = enemy.patrolTarget.x - enemy.mesh.position.x;
        const tdz = enemy.patrolTarget.z - enemy.mesh.position.z;
        const td = Math.sqrt(tdx * tdx + tdz * tdz);
        if (td < 2) {
            enemy.patrolTarget = {
                x: enemy.mesh.position.x + (Math.random() - 0.5) * 30,
                z: enemy.mesh.position.z + (Math.random() - 0.5) * 30
            };
        } else {
            const sp = enemy.speed * 0.4 * dt;
            const nx = enemy.mesh.position.x + tdx / td * sp;
            const nz = enemy.mesh.position.z + tdz / td * sp;
            if (!isEnemyBlocked(nx, nz)) {
                enemy.mesh.position.x = nx;
                enemy.mesh.position.z = nz;
            } else {
                enemy.patrolTarget = {
                    x: enemy.mesh.position.x + (Math.random() - 0.5) * 20,
                    z: enemy.mesh.position.z + (Math.random() - 0.5) * 20
                };
            }
            enemy.mesh.rotation.y = Math.atan2(tdx, tdz);
        }
    }

    /** 敌人碰撞检测 */
    function isEnemyBlocked(nx, nz) {
        for (const o of obstacles) {
            if (o.isAABB) {
                const hw = o.halfW + 0.6, hd = o.halfD + 0.6;
                const ox = o.mesh.position.x, oz = o.mesh.position.z;
                if (nx > ox - hw && nx < ox + hw && nz > oz - hd && nz < oz + hd) return true;
            }
        }
        return false;
    }

    /** 增强版敌人射击（可控制散射） */
    function enemyShoot(enemy, spread) {
        const o = new THREE.Vector3(enemy.mesh.position.x, 1.4, enemy.mesh.position.z);
        const d = new THREE.Vector3(playerGroup.position.x - o.x, 1.7 - o.y, playerGroup.position.z - o.z).normalize();
        const sp = spread || 0.08;
        d.x += (Math.random() - 0.5) * sp;
        d.y += (Math.random() - 0.5) * sp;
        d.normalize();
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
        b.position.copy(o);
        scene.add(b);
        bulletTrails.push({
            mesh: b, life: 40, isBullet: true,
            bulletData: { mesh: b, velocity: d.clone().multiplyScalar(1.5), life: 40, pos: o.clone(), dir: d.clone(), damage: enemy.damage }
        });
        // 枪口火光
        const muzzle = new THREE.Vector3(o.x + d.x * 0.5, 1.4 + d.y * 0.5, o.z + d.z * 0.5);
        createMuzzleFlash(muzzle);
    }

    return {
        updateEnemyAI,
        updateGrenades,
        onEnemyHit,
        startDeathAnimation,
        getGrenades: () => _grenades,
        enemyShoot,
    };
})();
