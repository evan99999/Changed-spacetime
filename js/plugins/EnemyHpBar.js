/*:
 * @plugindesc 敵人腳下顯示HP條與目前HP數字
 * @author ChatGPT
 *
 * @help
 * ============================================================
 * EnemyHpBar.js
 * RPG Maker MV
 * ============================================================
 *
 * 戰鬥開始後直接顯示所有敵人的：
 *
 * 敵人圖片
 *   ↓
 * HP血條
 *   ↓
 * 目前HP數字
 *
 * 不需要選擇敵人。
 *
 * ============================================================
 */

(function() {

    'use strict';

    //==========================================================
    // 顯示設定
    //==========================================================

    var BAR_WIDTH = 120;       // HP條寬度
    var BAR_HEIGHT = 8;        // HP條高度

    var BAR_Y = 4;             // 敵人圖片下方距離

    var TEXT_Y = 10;           // HP文字位置

    var FONT_SIZE = 16;        // HP文字大小


    //==========================================================
    // 建立HP顯示
    //==========================================================

    var _Sprite_Enemy_initialize =
        Sprite_Enemy.prototype.initialize;

    Sprite_Enemy.prototype.initialize = function(battler) {

        _Sprite_Enemy_initialize.call(this, battler);

        this.createEnemyHpDisplay();

    };


    //==========================================================
    // 建立HP條
    //==========================================================

    Sprite_Enemy.prototype.createEnemyHpDisplay = function() {

        this._enemyHpDisplay = new Sprite();

        this.addChild(this._enemyHpDisplay);


        //======================================================
        // HP背景
        //======================================================

        this._enemyHpBack =
            new Sprite(new Bitmap(BAR_WIDTH, BAR_HEIGHT));

        this._enemyHpBack.bitmap.fillRect(
            0,
            0,
            BAR_WIDTH,
            BAR_HEIGHT,
            '#222222'
        );

        this._enemyHpDisplay.addChild(
            this._enemyHpBack
        );


        //======================================================
        // HP條
        //======================================================

        this._enemyHpGauge =
            new Sprite(new Bitmap(BAR_WIDTH, BAR_HEIGHT));

        this._enemyHpDisplay.addChild(
            this._enemyHpGauge
        );


        //======================================================
        // HP數字
        //======================================================

        this._enemyHpText =
            new Sprite(
                new Bitmap(BAR_WIDTH + 40, 28)
            );

        this._enemyHpText.bitmap.fontSize = FONT_SIZE;

        this._enemyHpText.bitmap.textColor =
            '#ffffff';

        this._enemyHpText.bitmap.outlineColor =
            '#000000';

        this._enemyHpText.bitmap.outlineWidth =
            4;

        this._enemyHpDisplay.addChild(
            this._enemyHpText
        );


        // 初始位置
        this.updateEnemyHpDisplay();

    };


    //==========================================================
    // 每幀更新
    //==========================================================

    var _Sprite_Enemy_update =
        Sprite_Enemy.prototype.update;

    Sprite_Enemy.prototype.update = function() {

        _Sprite_Enemy_update.call(this);

        this.updateEnemyHpDisplay();

    };


    //==========================================================
    // 更新HP顯示
    //==========================================================

    Sprite_Enemy.prototype.updateEnemyHpDisplay = function() {

        if (!this._enemyHpDisplay) {
            return;
        }

        if (!this._enemy) {
            return;
        }


        //======================================================
        // 死亡後隱藏
        //======================================================

        if (this._enemy.isDead()) {

            this._enemyHpDisplay.visible = false;

            return;
        }

        this._enemyHpDisplay.visible = true;


        //======================================================
        // HP
        //======================================================

        var hp = Math.max(
            0,
            this._enemy.hp
        );

        var mhp = Math.max(
            1,
            this._enemy.mhp
        );


        //======================================================
        // HP比例
        //======================================================

        var rate = hp / mhp;

        rate = Math.max(
            0,
            Math.min(1, rate)
        );


        //======================================================
        // HP條
        //======================================================

        this._enemyHpGauge.bitmap.clear();

        this._enemyHpGauge.bitmap.fillRect(
            0,
            0,
            Math.floor(BAR_WIDTH * rate),
            BAR_HEIGHT,
            '#e53935'
        );


        //======================================================
        // HP數字
        //======================================================

        this._enemyHpText.bitmap.clear();

        this._enemyHpText.bitmap.fontSize =
            FONT_SIZE;

        this._enemyHpText.bitmap.textColor =
            '#ffffff';

        this._enemyHpText.bitmap.outlineColor =
            '#000000';

        this._enemyHpText.bitmap.outlineWidth =
            4;


        this._enemyHpText.bitmap.drawText(
            this.formatNumber(hp),
            -20,
            TEXT_Y,
            BAR_WIDTH + 40,
            28,
            'center'
        );


        //======================================================
        // 位置
        //======================================================

        this._enemyHpDisplay.x =
            -BAR_WIDTH / 2;

        // ★ 重點：
        // 不再使用 this.height + 10
        // 直接放在敵人圖片底部附近
        this._enemyHpDisplay.y =
            BAR_Y;

    };


    //==========================================================
    // 數字千分位
    //==========================================================

    Sprite_Enemy.prototype.formatNumber =
        function(number) {

        number = Math.floor(number);

        return number.toString().replace(
            /\B(?=(\d{3})+(?!\d))/g,
            ','
        );

    };


})();