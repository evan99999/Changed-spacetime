/*:
 * @plugindesc BattleMotionSystem 4.2 - 選定敵人後實際移動攻擊
 * @author ChatGPT
 *
 * @help
 * ============================================================
 * BattleMotionSystem 4.2
 * RPG Maker MV
 * ============================================================
 *
 * 【普通攻擊】
 *
 * 1. 玩家選擇「攻擊」
 * 2. 選擇指定敵人
 * 3. 角色移動到該敵人前方
 * 4. 攻擊動作
 * 5. 敵人受擊
 * 6. 角色返回原位置
 *
 * ============================================================
 *
 * 【技能備註】
 *
 * <BattleMotion:Dash>
 * 技能會移動到選定敵人前方
 *
 * <BattleMotion:Jump>
 * 跳躍
 *
 * <BattleMotion:Hover>
 * 懸浮
 *
 * <BattleMotion:RedGlow>
 * 紅光
 *
 * ============================================================
 *
 * 【插件指令】
 *
 * BattleMotion Hover 1 60 30
 *
 * BattleMotion Jump 1 60 120
 *
 * BattleMotion RedGlow 1 30
 *
 * BattleMotion Reset 1
 *
 * ============================================================
 */

(function() {

    'use strict';


    //==========================================================
    // 設定
    //==========================================================

    var MOVE_FRAMES = 12;

    var RETURN_FRAMES = 12;

    var ATTACK_FRAMES = 10;

    var ATTACK_DISTANCE = 100;

    var ATTACK_LUNGE = 15;

    var HIT_SHAKE_POWER = 8;

    var HIT_SHAKE_TIME = 10;

    var CRITICAL_SHAKE_POWER = 16;

    var CRITICAL_SHAKE_TIME = 16;

    var HIT_FLASH_TIME = 5;

    var HOVER_HEIGHT = 25;

    var JUMP_HEIGHT = 120;


    //==========================================================
    // Game_Action
    //
    // 記錄真正被玩家選中的目標
    //==========================================================

    var _Game_Action_setTarget =
        Game_Action.prototype.setTarget;

    Game_Action.prototype.setTarget =
        function(index) {

        _Game_Action_setTarget.call(
            this,
            index
        );

        this._BM_selectedTargetIndex =
            index;

    };


    //==========================================================
    // Game_Actor
    //
    // 保存目前 Action 的目標
    //==========================================================

    var _Game_Actor_makeActions =
        Game_Actor.prototype.makeActions;

    Game_Actor.prototype.makeActions =
        function() {

        _Game_Actor_makeActions.call(this);

        for (
            var i = 0;
            i < this._actions.length;
            i++
        ) {

            if (this._actions[i]) {

                this._actions[i]._BM_selectedTargetIndex =
                    -1;

            }

        }

    };


    //==========================================================
    // Sprite_Actor 初始化
    //==========================================================

    var _Sprite_Actor_initMembers =
        Sprite_Actor.prototype.initMembers;

    Sprite_Actor.prototype.initMembers =
        function() {

        _Sprite_Actor_initMembers.call(this);

        this._BM4Active = false;

        this._BM4Phase = '';

        this._BM4Timer = 0;

        this._BM4OriginalX = 0;

        this._BM4OriginalY = 0;

        this._BM4TargetX = 0;

        this._BM4TargetY = 0;

        this._BM4Target = null;

        this._BM4TargetSprite = null;

        this._BM4Direction = 1;

        this._BM4MotionType = '';

        this._BM4MotionTimer = 0;

        this._BM4MotionDuration = 0;

        this._BM4MotionBaseX = 0;

        this._BM4MotionBaseY = 0;

        this._BM4MotionValue = 0;

    };


    //==========================================================
    // Sprite_Actor 更新
    //==========================================================

    var _Sprite_Actor_update =
        Sprite_Actor.prototype.update;

    Sprite_Actor.prototype.update =
        function() {

        _Sprite_Actor_update.call(this);

        this.updateBM4BattleMovement();

        this.updateBM4SpecialMotion();

    };


    //==========================================================
    // Action
    //==========================================================

    var _Sprite_Actor_performAction =
        Sprite_Actor.prototype.performAction;

    Sprite_Actor.prototype.performAction =
        function(action) {

        _Sprite_Actor_performAction.call(
            this,
            action
        );

        if (!action) {
            return;
        }

        if (action.isAttack()) {

            this.startBM4ActionMove(
                action
            );

        }

        if (action.isSkill()) {

            this.checkBM4Skill(
                action
            );

        }

    };


    //==========================================================
    // 找真正目標
    //==========================================================

    Sprite_Actor.prototype.getBM4ActionTarget =
        function(action) {

        if (!action) {
            return null;
        }


        var targets =
            action.makeTargets();


        if (!targets ||
            targets.length === 0) {

            return null;

        }


        var selectedIndex =
            action._BM_selectedTargetIndex;


        //======================================================
        // 單體目標
        //======================================================

        if (
            selectedIndex !== undefined &&
            selectedIndex !== null &&
            selectedIndex >= 0
        ) {

            var subject =
                action.subject();


            if (subject &&
                subject.isActor()) {

                var enemies =
                    $gameTroop.members();


                if (
                    enemies[selectedIndex]
                ) {

                    return enemies[
                        selectedIndex
                    ];

                }

            }

        }


        //======================================================
        // 找不到索引時
        // 使用第一個實際目標
        //======================================================

        return targets[0];

    };


    //==========================================================
    // 開始移動
    //==========================================================

    Sprite_Actor.prototype.startBM4ActionMove =
        function(action) {

        var target =
            this.getBM4ActionTarget(
                action
            );


        if (!target) {
            return;
        }


        var targetSprite =
            this.findBM4EnemySprite(
                target
            );


        if (!targetSprite) {
            return;
        }


        //======================================================
        // 保存原位置
        //======================================================

        this._BM4OriginalX =
            this.x;

        this._BM4OriginalY =
            this.y;


        //======================================================
        // 保存目標
        //======================================================

        this._BM4Target =
            target;

        this._BM4TargetSprite =
            targetSprite;


        //======================================================
        // 判斷左右
        //======================================================

        if (
            targetSprite.x <
            this.x
        ) {

            this._BM4Direction = -1;

        } else {

            this._BM4Direction = 1;

        }


        //======================================================
        // 計算敵人正前方
        //======================================================

        this._BM4TargetX =
            targetSprite.x -
            this._BM4Direction *
            ATTACK_DISTANCE;


        this._BM4TargetY =
            targetSprite.y;


        //======================================================
        // 啟動
        //======================================================

        this._BM4Active = true;

        this._BM4Phase = 'move';

        this._BM4Timer = 0;

    };


    //==========================================================
    // 移動更新
    //==========================================================

    Sprite_Actor.prototype.updateBM4BattleMovement =
        function() {

        if (!this._BM4Active) {
            return;
        }


        this._BM4Timer++;


        //======================================================
        // 第一階段：跑向敵人
        //======================================================

        if (
            this._BM4Phase ===
            'move'
        ) {

            var rate =
                this._BM4Timer /
                MOVE_FRAMES;


            rate =
                Math.min(
                    1,
                    rate
                );


            // Ease Out
            var ease =
                1 -
                Math.pow(
                    1 - rate,
                    3
                );


            this.x =
                this._BM4OriginalX +
                (
                    this._BM4TargetX -
                    this._BM4OriginalX
                ) *
                ease;


            this.y =
                this._BM4OriginalY +
                (
                    this._BM4TargetY -
                    this._BM4OriginalY
                ) *
                ease;


            if (
                this._BM4Timer >=
                MOVE_FRAMES
            ) {

                this.x =
                    this._BM4TargetX;

                this.y =
                    this._BM4TargetY;

                this._BM4Phase =
                    'attack';

                this._BM4Timer = 0;

            }

        }


        //======================================================
        // 第二階段：攻擊
        //======================================================

        else if (
            this._BM4Phase ===
            'attack'
        ) {

            if (
                this._BM4Timer === 1
            ) {

                this.executeBM4AttackMotion();

            }


            if (
                this._BM4Timer >=
                ATTACK_FRAMES
            ) {

                this._BM4Phase =
                    'return';

                this._BM4Timer = 0;

            }

        }


        //======================================================
        // 第三階段：返回
        //======================================================

        else if (
            this._BM4Phase ===
            'return'
        ) {

            var returnRate =
                this._BM4Timer /
                RETURN_FRAMES;


            returnRate =
                Math.min(
                    1,
                    returnRate
                );


            var returnEase =
                1 -
                Math.pow(
                    1 - returnRate,
                    3
                );


            this.x =
                this._BM4TargetX +
                (
                    this._BM4OriginalX -
                    this._BM4TargetX
                ) *
                returnEase;


            this.y =
                this._BM4TargetY +
                (
                    this._BM4OriginalY -
                    this._BM4TargetY
                ) *
                returnEase;


            if (
                this._BM4Timer >=
                RETURN_FRAMES
            ) {

                this.x =
                    this._BM4OriginalX;

                this.y =
                    this._BM4OriginalY;

                this._BM4Active =
                    false;

                this._BM4Phase =
                    '';

                this._BM4Target =
                    null;

                this._BM4TargetSprite =
                    null;

            }

        }

    };


    //==========================================================
    // 攻擊動作
    //==========================================================

    Sprite_Actor.prototype.executeBM4AttackMotion =
        function() {

        var targetSprite =
            this._BM4TargetSprite;


        if (!targetSprite) {
            return;
        }


        //======================================================
        // 攻擊瞬間往前
        //======================================================

        this.x +=
            this._BM4Direction *
            ATTACK_LUNGE;


        //======================================================
        // 敵人受擊
        //======================================================

        targetSprite.startBM4HitEffect();


        //======================================================
        // 暴擊
        //======================================================

        if (
            this._BM4Target &&
            this._BM4Target.result
        ) {

            var result =
                this._BM4Target.result();


            if (
                result &&
                result.critical
            ) {

                targetSprite
                    .startBM4CriticalEffect();

            }

        }

    };


    //==========================================================
    // 找敵人 Sprite
    //==========================================================

    Sprite_Actor.prototype.findBM4EnemySprite =
        function(target) {

        var scene =
            SceneManager._scene;


        if (
            !scene ||
            !scene._spriteset
        ) {

            return null;

        }


        var sprites =
            scene._spriteset._enemySprites;


        if (!sprites) {
            return null;
        }


        for (
            var i = 0;
            i < sprites.length;
            i++
        ) {

            if (
                sprites[i]._battler ===
                target
            ) {

                return sprites[i];

            }

        }


        return null;

    };


    //==========================================================
    // Enemy 初始化
    //==========================================================

    var _Sprite_Enemy_initMembers =
        Sprite_Enemy.prototype.initMembers;

    Sprite_Enemy.prototype.initMembers =
        function() {

        _Sprite_Enemy_initMembers.call(this);

        this._BM4ShakeTimer = 0;

        this._BM4ShakePower = 0;

        this._BM4ShakeBaseX = 0;

        this._BM4FlashTimer = 0;

    };


    //==========================================================
    // Enemy 更新
    //==========================================================

    var _Sprite_Enemy_update =
        Sprite_Enemy.prototype.update;

    Sprite_Enemy.prototype.update =
        function() {

        _Sprite_Enemy_update.call(this);

        this.updateBM4EnemyEffect();

    };


    //==========================================================
    // 普通受擊
    //==========================================================

    Sprite_Enemy.prototype.startBM4HitEffect =
        function() {

        this._BM4ShakeTimer =
            HIT_SHAKE_TIME;

        this._BM4ShakePower =
            HIT_SHAKE_POWER;

        this._BM4ShakeBaseX =
            this.x;

        this._BM4FlashTimer =
            HIT_FLASH_TIME;

    };


    //==========================================================
    // 暴擊
    //==========================================================

    Sprite_Enemy.prototype.startBM4CriticalEffect =
        function() {

        this._BM4ShakeTimer =
            CRITICAL_SHAKE_TIME;

        this._BM4ShakePower =
            CRITICAL_SHAKE_POWER;

        this._BM4ShakeBaseX =
            this.x;

        this._BM4FlashTimer =
            HIT_FLASH_TIME + 3;

    };


    //==========================================================
    // 敵人效果更新
    //==========================================================

    Sprite_Enemy.prototype.updateBM4EnemyEffect =
        function() {

        if (
            this._BM4ShakeTimer > 0
        ) {

            this._BM4ShakeTimer--;


            this.x =
                this._BM4ShakeBaseX +
                (
                    Math.random() * 2 - 1
                ) *
                this._BM4ShakePower;


            if (
                this._BM4ShakeTimer <= 0
            ) {

                this.x =
                    this._BM4ShakeBaseX;

            }

        }


        if (
            this._BM4FlashTimer > 0
        ) {

            this._BM4FlashTimer--;


            this.setBlendColor([
                255,
                255,
                255,
                220
            ]);

        } else {

            this.setBlendColor([
                0,
                0,
                0,
                0
            ]);

        }

    };


    //==========================================================
    // 技能動作
    //==========================================================

    Sprite_Actor.prototype.checkBM4Skill =
        function(action) {

        if (!action ||
            !action.item()) {

            return;

        }


        var note =
            action.item().note || '';


        var match =
            note.match(
                /<BattleMotion\s*:\s*(\w+)>/i
            );


        if (!match) {
            return;
        }


        var type =
            match[1].toLowerCase();


        if (
            type ===
            'dash'
        ) {

            this.startBM4ActionMove(
                action
            );

        }


        if (
            type ===
            'jump'
        ) {

            this.startBattleMotion(
                'Jump',
                60,
                JUMP_HEIGHT
            );

        }


        if (
            type ===
            'hover'
        ) {

            this.startBattleMotion(
                'Hover',
                60,
                HOVER_HEIGHT
            );

        }


        if (
            type ===
            'redglow'
        ) {

            this.startBattleMotion(
                'RedGlow',
                30,
                0
            );

        }

    };


    //==========================================================
    // 特殊動作
    //==========================================================

    Sprite_Actor.prototype.startBattleMotion =
        function(
            type,
            duration,
            value
        ) {

        this._BM4MotionType =
            type;

        this._BM4MotionTimer =
            0;

        this._BM4MotionDuration =
            Number(duration) || 60;

        this._BM4MotionBaseX =
            this.x;

        this._BM4MotionBaseY =
            this.y;

        this._BM4MotionValue =
            Number(value) || 0;

    };


    //==========================================================
    // 特殊動作更新
    //==========================================================

    Sprite_Actor.prototype.updateBM4SpecialMotion =
        function() {

        if (!this._BM4MotionType) {
            return;
        }


        this._BM4MotionTimer++;


        //======================================================
        // 懸浮
        //======================================================

        if (
            this._BM4MotionType ===
            'Hover'
        ) {

            var hoverHeight =
                this._BM4MotionValue ||
                HOVER_HEIGHT;


            this.y =
                this._BM4MotionBaseY +
                Math.sin(
                    this._BM4MotionTimer *
                    0.08
                ) *
                hoverHeight;

        }


        //======================================================
        // 跳躍
        //======================================================

        if (
            this._BM4MotionType ===
            'Jump'
        ) {

            var jumpHeight =
                this._BM4MotionValue ||
                JUMP_HEIGHT;


            var p =
                this._BM4MotionTimer /
                this._BM4MotionDuration;


            p =
                Math.min(
                    1,
                    p
                );


            this.y =
                this._BM4MotionBaseY -
                Math.sin(
                    p *
                    Math.PI
                ) *
                jumpHeight;

        }


        //======================================================
        // 紅光
        //======================================================

        if (
            this._BM4MotionType ===
            'RedGlow'
        ) {

            var alpha =
                (
                    Math.sin(
                        this._BM4MotionTimer *
                        0.5
                    ) *
                    0.5 +
                    0.5
                ) *
                255;


            this.setBlendColor([
                255,
                0,
                0,
                alpha
            ]);

        }


        if (
            this._BM4MotionTimer >=
            this._BM4MotionDuration
        ) {

            this.endBM4SpecialMotion();

        }

    };


    //==========================================================
    // 結束特殊動作
    //==========================================================

    Sprite_Actor.prototype.endBM4SpecialMotion =
        function() {

        this._BM4MotionType =
            '';

        this._BM4MotionTimer =
            0;


        this.x =
            this._BM4MotionBaseX;

        this.y =
            this._BM4MotionBaseY;


        this.setBlendColor([
            0,
            0,
            0,
            0
        ]);

    };


    //==========================================================
    // 插件指令
    //==========================================================

    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;


    Game_Interpreter.prototype.pluginCommand =
        function(command, args) {

        _Game_Interpreter_pluginCommand.call(
            this,
            command,
            args
        );


        if (
            command !==
            'BattleMotion'
        ) {

            return;

        }


        var type =
            String(
                args[0] || ''
            ).toLowerCase();


        var actorId =
            Number(
                args[1] || 1
            );


        var duration =
            Number(
                args[2] || 60
            );


        var value =
            Number(
                args[3] || 0
            );


        var sprite =
            getBM4ActorSprite(
                actorId
            );


        if (!sprite) {
            return;
        }


        if (
            type ===
            'hover'
        ) {

            sprite.startBattleMotion(
                'Hover',
                duration,
                value ||
                HOVER_HEIGHT
            );

        }


        if (
            type ===
            'jump'
        ) {

            sprite.startBattleMotion(
                'Jump',
                duration,
                value ||
                JUMP_HEIGHT
            );

        }


        if (
            type ===
            'redglow'
        ) {

            sprite.startBattleMotion(
                'RedGlow',
                duration,
                0
            );

        }


        if (
            type ===
            'reset'
        ) {

            sprite.endBM4SpecialMotion();

        }

    };


    //==========================================================
    // 找角色 Sprite
    //==========================================================

    function getBM4ActorSprite(actorId) {

        var scene =
            SceneManager._scene;


        if (
            !scene ||
            !scene._spriteset
        ) {

            return null;

        }


        var sprites =
            scene._spriteset._actorSprites;


        if (!sprites) {
            return null;
        }


        for (
            var i = 0;
            i < sprites.length;
            i++
        ) {

            if (
                sprites[i]._actor &&
                sprites[i]._actor.actorId() ===
                actorId
            ) {

                return sprites[i];

            }

        }


        return null;

    }


})();