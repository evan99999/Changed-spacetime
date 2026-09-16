//=============================================================================
// Roasttext_Messages.js
//=============================================================================
/*:
 * @plugindesc 在RPG MV中的顯示文字上新增小註解(吐槽)
 * @author Mirai
 * @help
 * 
 * ─ 插件簡介 ─
 * 在RPG MV中的顯示文字上新增小註解(吐槽)
 * 
 * ─ 使用說明 ─
 * ---------
 * ◇插件方面
 * ---------
 * 在設置事件點內容時，新增第三頁之高級區塊裡的「插件命令...」，
 * 並輸入以下的插件指令：Roast Set [編號] [文字註解(吐槽)] [偏移值]，
 * 例如：Roast Set 5 智障兔子 1
 * 然後在新增第一頁之訊息區塊裡的「顯示文字...」，
 * 並在指定的字元加上「\RO[編號]\ST」，
 * 例如：你也喜歡\RO[5]\ST粉紅色兔子嗎?
 * 而插件指令的[偏移值]只要如果與下方的詞句有偏移時才用，不然就設為「0」就好
 * 
 * ---------
 * ◇腳本方面
 * ---------
 * 在設置事件點內容時，新增第三頁之高級區塊裡的「腳本...」，
 * 並輸入以下的腳本指令：$gameSystem.SetRoast(編號, "文字註解(吐槽)", 偏移值);
 * 例如：$gameSystem.SetRoast(5, "智障兔子", 1);
 * 記得「文字註解(吐槽)」前後兩邊記得要加上雙引號「"」喔
 * 然後在新增第一頁之訊息區塊裡的「顯示文字...」，
 * 並在指定的字元加上「\RO[編號]\ST」，
 * 例如：你也喜歡\RO[5]\ST粉紅色兔子嗎?
 * 而腳本指令的「偏移值」只要如果與下方的詞句有偏移時才用，不然就設為「0」就好
 * 
 * 
 * 
 * ─ 更新履歷 ─
 * V1.2 新增腳本指令
 * V1.0 初次發布
 * 
 * 
 * 
 * ─ 插件指令 ─
 * 設置文字註解(吐槽)的指令，例如：Roast Set 5 智障兔子 1 
 * -----------
 * --插件指令：Roast Set [編號] [文字註解(吐槽)] [偏移值]
 * -----------
 * 
 * ─ 腳本指令 ─
 * 設置文字註解(吐槽)的指令，例如：$gameSystem.SetRoast(5, "智障兔子", 1);
 * -----------
 * --腳本指令：$gameSystem.SetRoast(編號, "文字註解(吐槽)", 偏移值);
 * -----------
 * 
 * ─ 文字指令 ─
 * 在顯示文字裡呼叫文字註解(吐槽)的指令，例如：你也喜歡\RO[5]\ST粉紅色兔子嗎?
 * -----------
 * --文字指令：\RO[編號]\ST
 * -----------
 * 
 * 
 * @param No data
 * @desc (無參數)
 * @text (無參數)
 * @default 
 * 
 */
//=============================================================================
// ** PLUGIN PARAMETERS - 插件參數
//=============================================================================

(function () {
    var parameters = PluginManager.parameters('Roasttext_Messages');
    var losyjj = false;
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'Roast') {
            switch (args[0]) {
                case 'Set':
                    localStorage.setItem("Roast_" + parseFloat(args[1]), args[2]);
                    localStorage.setItem("RoastNum_" + parseFloat(args[1]), parseFloat(args[3]));
                    break;
            }
        }
    };

    Game_System.prototype.SetRoast = function (roast_num, roast_text, roast_x) {
        localStorage.setItem("Roast_" + parseFloat(roast_num), roast_text);
        localStorage.setItem("RoastNum_" + parseFloat(roast_num), parseFloat(roast_x));

    };
    Window_Base.prototype.processEscapeCharacter = function (code, textState) {
        switch (code) {
            case 'C':
                this.changeTextColor(this.textColor(this.obtainEscapeParam(textState)));
                break;
            case 'I':
                this.processDrawIcon(this.obtainEscapeParam(textState), textState);
                break;
            case 'RO':
                this.processdrawRoast(this.obtainEscapeParam(textState), textState);
                break;
            case 'ST':
                this.clearRoast();
                break;
            case '{':
                this.makeFontBigger();
                break;
            case '}':
                this.makeFontSmaller();
                break;
            case 'FS':
                var size = this.obtainEscapeParam(textState);
                this.contents.fontSize = size;
                if (Yanfly.Param.MSGFontMaintain) $gameSystem.setMessageFontSize(size);
                break;
            case 'FN':
                var name = this.obtainEscapeString(textState);
                this.contents.fontFace = name;
                if (Yanfly.Param.MSGFontMaintain) $gameSystem.setMessageFontName(name);
                break;
        }
    };


    Window_Message.prototype.onEndOfText = function () {
        if (!this.startInput()) {

            if (!this._pauseSkip) {
                this.startPause();
            } else {

                this.terminateMessage();
                localStorage.clear();
            }
        }
        this._textState = null;
    };
    Window_Message.prototype.newPage = function (textState) {
        this.contents.clear();
        this.resetFontSettings();
        this.clearFlags();
        this.loadMessageFace();
        losyjj = true;
        Window_Base.prototype.updatePadding.call(this);
        textState.x = this.newLineX() + 12;
        textState.y = 6;
        textState.left = this.newLineX() + 12;
        textState.height = this.calcTextHeight(textState, false);
    };


    Window_Message.prototype.terminateMessage = function () {
        this.close();
        this._goldWindow.close();
        $gameMessage.clear();
        losyjj = false;

    };

    Window_Base.prototype.contentsHeight = function () {
        return this.height - this.standardPadding() * 2 + 25;
    };
    Window_Base.prototype.processNewLine = function (textState) {
        textState.x = textState.left;
        if (losyjj == true) {
            textState.y += textState.height + 4;
        } else {
            textState.y += textState.height
        }

        textState.height = this.calcTextHeight(textState, false);
        textState.index++;
    };
    Window_Base.prototype.updatePadding = function () {
        if (losyjj == true) {
            this.padding = this.standardPadding() - 12;
        } else {
            this.padding = this.standardPadding();
        }

    };
    Window_Base.prototype.processdrawRoast = function (index, textState) {
        var text = localStorage.getItem("Roast_" + index);
        var gfd = 18 * localStorage.getItem("RoastNum_" + index);
        var x = textState.x - gfd + (this.textWidth() / 2);
        var y = textState.y - 19;
        this.contents.fontSize = 11;
        this.contents.outlineColor = 'black';
        this.contents.outlineWidth = 2;
        this.drawText(text, x, y, this.textWidth(), this.lineHeight(), 'left');
    };

    Window_Base.prototype.clearRoast = function () {
        this.contents.fontSize = 28;
        this.contents.outlineColor = 'black';
        this.contents.outlineWidth = 3;
    };

})();

