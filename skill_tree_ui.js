// ========== 技能树UI模块（优化版） ==========
const SkillTreeUI = (function() {
    let _panel = null;
    let _isOpen = false;
    let _tooltip = null;

    function _createTooltip() {
        if (_tooltip) return;
        _tooltip = document.createElement('div');
        _tooltip.id = 'skillTooltip';
        _tooltip.style.cssText = 'position:fixed;display:none;background:rgba(10,14,20,0.95);border:1px solid #ff9800;border-radius:8px;padding:12px;max-width:280px;z-index:1000;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.5);font-size:12px;';
        document.body.appendChild(_tooltip);
    }

    function _showTooltip(e, treeId, skill) {
        if (!_tooltip) _createTooltip();
        const level = getSkillLevel(treeId, skill.id);
        const effectValue = getSkillEffect(treeId, skill.id);
        const totalEffect = getTotalSkillEffect(skill.effectType);

        let effectDesc = '';
        if (skill.effectType && effectValue !== undefined) {
            const isPercent = skill.desc.includes('%') || skill.effectType.includes('Speed') || skill.effectType.includes('Boost') || skill.effectType.includes('Reduction');
            const displayValue = isPercent ? Math.round(effectValue * 100) + '%' : effectValue;
            effectDesc = `<div style="color:#4caf50;margin-top:8px;padding-top:8px;border-top:1px solid #333;">
                <div style="color:#8b949e;font-size:10px;">当前等级效果</div>
                <div style="color:#fff;font-size:14px;font-weight:bold;">+${displayValue}</div>
            </div>`;
        }

        if (totalEffect !== undefined && totalEffect > 0) {
            const isPercent = skill.desc.includes('%') || skill.effectType.includes('Speed') || skill.effectType.includes('Boost') || skill.effectType.includes('Reduction');
            const displayTotal = isPercent ? Math.round(totalEffect * 100) + '%' : totalEffect;
            effectDesc += `<div style="color:#ff9800;margin-top:6px;">
                <div style="color:#8b949e;font-size:10px;">该属性总加成（含其他技能）</div>
                <div style="color:#ffc107;font-size:13px;font-weight:bold;">+${displayTotal}</div>
            </div>`;
        }

        _tooltip.innerHTML = `
            <div style="color:#ff9800;font-weight:bold;font-size:14px;margin-bottom:4px;">${skill.name}${skill.isUltimate ? ' ⭐ 终极技能' : ''}</div>
            <div style="color:#8b949e;font-size:11px;margin-bottom:4px;">${skill.desc}</div>
            <div style="color:#fff;font-size:11px;">等级: ${level}/${skill.maxLevel}</div>
            ${effectDesc}
            ${level < skill.maxLevel ? `<div style="color:#ffc107;font-size:10px;margin-top:8px;">下一级消耗: ${skill.cost} 技能点</div>` : ''}
        `;
        _tooltip.style.display = 'block';

        // 定位tooltip，避免超出屏幕
        const tooltipRect = _tooltip.getBoundingClientRect();
        let x = e.clientX + 15;
        let y = e.clientY + 15;
        if (x + tooltipRect.width > window.innerWidth) x = e.clientX - tooltipRect.width - 15;
        if (y + tooltipRect.height > window.innerHeight) y = e.clientY - tooltipRect.height - 15;
        _tooltip.style.left = x + 'px';
        _tooltip.style.top = y + 'px';
    }

    function _hideTooltip() {
        if (_tooltip) _tooltip.style.display = 'none';
    }

    function _createPanel() {
        if (_panel) return;
        _panel = document.createElement('div');
        _panel.id = 'skillTreePanel';
        _panel.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:500;display:none;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
        _panel.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #ff9800;border-radius:16px;padding:30px;width:90%;max-width:1100px;max-height:90vh;overflow-y:auto;box-shadow:0 0 40px rgba(255,152,0,0.3);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:#ff9800;margin:0;font-size:28px;">🌟 技能树</h2>
                    <div style="display:flex;align-items:center;gap:20px;">
                        <div style="background:rgba(255,152,0,0.1);border:1px solid #ff9800;border-radius:8px;padding:8px 16px;">
                            <span style="color:#8b949e;font-size:12px;">可用技能点</span>
                            <span id="skillPointsDisplay" style="color:#ffc107;font-weight:bold;font-size:24px;margin-left:8px;">0</span>
                        </div>
                        <button onclick="SkillTreeUI.close()" style="background:#333;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:16px;">✕ 关闭</button>
                    </div>
                </div>
                <div id="skillTreesContainer" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;"></div>
                <div style="margin-top:20px;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;color:#8b949e;font-size:12px;text-align:center;">
                    💡 提示：升级获得技能点，鼠标悬停查看技能效果详情，点击技能图标解锁。终极技能需要先解锁该系所有普通技能。
                </div>
            </div>
        `;
        document.body.appendChild(_panel);
    }

    function _renderSkillTree(treeId) {
        const tree = SKILL_TREES[treeId];
        if (!tree) return '';
        let html = `
            <div style="background:rgba(0,0,0,0.4);border:2px solid ${tree.color};border-radius:12px;padding:15px;">
                <div style="text-align:center;margin-bottom:15px;">
                    <div style="font-size:36px;">${tree.icon}</div>
                    <div style="color:${tree.color};font-size:20px;font-weight:bold;">${tree.name}系</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
        `;
        for (const skill of tree.skills) {
            const level = getSkillLevel(treeId, skill.id);
            const maxed = level >= skill.maxLevel;
            const canUnlock = canUnlockSkill(treeId, skill.id);
            const isUltimate = skill.isUltimate;

            // 增强的视觉效果
            let bgColor, borderColor, opacity, boxShadow;
            if (maxed) {
                bgColor = `linear-gradient(135deg, ${tree.color}33, ${tree.color}11)`;
                borderColor = tree.color;
                opacity = '1';
                boxShadow = `0 0 15px ${tree.color}66, inset 0 0 10px ${tree.color}22`;
            } else if (canUnlock) {
                bgColor = 'rgba(255,255,255,0.08)';
                borderColor = tree.color;
                opacity = '1';
                boxShadow = `0 0 8px ${tree.color}44`;
            } else {
                bgColor = 'rgba(0,0,0,0.3)';
                borderColor = '#444';
                opacity = '0.5';
                boxShadow = 'none';
            }

            html += `
                <div onclick="SkillTreeUI.unlockSkill('${treeId}','${skill.id}')"
                     onmouseenter="SkillTreeUI.showTooltip(event,'${treeId}','${skill.id}')"
                     onmousemove="SkillTreeUI.moveTooltip(event)"
                     onmouseleave="SkillTreeUI.hideTooltip()"
                     style="background:${bgColor};border:2px solid ${borderColor};border-radius:8px;padding:12px;cursor:${canUnlock ? 'pointer' : 'not-allowed'};opacity:${opacity};transition:all 0.2s;box-shadow:${boxShadow};${isUltimate ? 'border-style:dashed;' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <span style="color:#fff;font-weight:bold;font-size:14px;">${skill.name}${isUltimate ? ' ⭐' : ''}${maxed ? ' ✅' : ''}</span>
                        <span style="color:${maxed ? '#4caf50' : '#ff9800'};font-size:12px;font-weight:bold;">${level}/${skill.maxLevel}</span>
                    </div>
                    <div style="color:#8b949e;font-size:11px;margin-bottom:5px;">${skill.desc}</div>
                    <div style="display:flex;gap:3px;">
            `;
            for (let i = 0; i < skill.maxLevel; i++) {
                const filled = i < level;
                html += `<div style="flex:1;height:6px;background:${filled ? tree.color : '#333'};border-radius:3px;${filled ? 'box-shadow:0 0 4px ' + tree.color : ''}"></div>`;
            }
            html += `
                    </div>
                    ${!maxed ? `<div style="color:#ffc107;font-size:10px;margin-top:5px;">消耗: ${skill.cost} 技能点</div>` : '<div style="color:#4caf50;font-size:10px;margin-top:5px;">✓ 已满级</div>'}
                </div>
            `;
        }
        html += `
                </div>
            </div>
        `;
        return html;
    }

    function _render() {
        if (!_panel) return;
        const container = _panel.querySelector('#skillTreesContainer');
        if (!container) return;
        let html = '';
        for (const treeId in SKILL_TREES) {
            html += _renderSkillTree(treeId);
        }
        container.innerHTML = html;
        const pointsDisplay = _panel.querySelector('#skillPointsDisplay');
        if (pointsDisplay) {
            pointsDisplay.textContent = P.skillPoints || 0;
            // 技能点>0时添加脉冲动画
            if ((P.skillPoints || 0) > 0) {
                pointsDisplay.style.animation = 'pulse 1s ease-in-out infinite';
            } else {
                pointsDisplay.style.animation = 'none';
            }
        }
    }

    function open() {
        _createPanel();
        _createTooltip();
        if (!_panel) return;
        _panel.style.display = 'flex';
        _isOpen = true;
        _render();
        if (document.pointerLockElement) document.exitPointerLock();
    }

    function close() {
        if (!_panel) return;
        _panel.style.display = 'none';
        _isOpen = false;
        _hideTooltip();
        if (S.phase === 'playing') {
            try {
                document.getElementById('gameCanvas').requestPointerLock();
            } catch(e) {}
        }
    }

    function toggle() {
        if (_isOpen) close();
        else open();
    }

    function tryUnlockSkill(treeId, skillId) {
        if (typeof unlockSkill === 'function' && unlockSkill(treeId, skillId)) {
            _render();
            // 播放解锁音效
            try {
                if (typeof sfxSearchComplete === 'function') sfxSearchComplete();
            } catch(e) {}
            // 显示解锁成功提示
            const skill = SKILL_TREES[treeId]?.skills?.find(s => s.id === skillId);
            if (skill) {
                showFloatingMsg(`✨ 已解锁: ${skill.name}`);
            }
        } else {
            showFloatingMsg('❌ 无法解锁该技能（技能点不足或前置技能未解锁）');
        }
    }

    function showTooltip(e, treeId, skillId) {
        const tree = SKILL_TREES[treeId];
        if (!tree) return;
        const skill = tree.skills.find(s => s.id === skillId);
        if (!skill) return;
        _showTooltip(e, treeId, skill);
    }

    function moveTooltip(e) {
        if (!_tooltip || _tooltip.style.display === 'none') return;
        const tooltipRect = _tooltip.getBoundingClientRect();
        let x = e.clientX + 15;
        let y = e.clientY + 15;
        if (x + tooltipRect.width > window.innerWidth) x = e.clientX - tooltipRect.width - 15;
        if (y + tooltipRect.height > window.innerHeight) y = e.clientY - tooltipRect.height - 15;
        _tooltip.style.left = x + 'px';
        _tooltip.style.top = y + 'px';
    }

    function isOpen() {
        return _isOpen;
    }

    return {
        open,
        close,
        toggle,
        unlockSkill: tryUnlockSkill,
        showTooltip,
        moveTooltip,
        hideTooltip: _hideTooltip,
        isOpen
    };
})();
