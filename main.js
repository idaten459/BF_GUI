(function () {
    window.onload = function () {
        main();
    };
})();
/*
警告を出すかどうか
1. 左括弧が足りない、かつその左括弧が実行中にジャンプ対象にならない
2. 見ているヘッダが負になる
エラーは
1. 右括弧が足りない
2. 左括弧が足りない、かつその左括弧が実行中にジャンプ対象になる
3. 見ているヘッダが負のときにインクリメント、デクリメントを行う
*/
var warning = false;
function set_table(table, n, m, data) {
    table.rows[n].cells[m].firstChild.data = data;
}
function get_table(table, n, m) {
    return table.rows[n].cells[m].firstChild.data;
}
var BfTable = /** @class */ (function () {
    function BfTable(row, column, html_table) {
        this.disit_width = 3;
        this.row = row;
        this.column = column;
        this.board = new Array(row);
        for (var i = 0; i < row; i++) {
            this.board[i] = new Array(column).fill(0);
        }
        this.html_table = html_table;
    }
    BfTable.prototype.reset = function () {
        for (var i = 0; i < this.row; i++) {
            this.board[i] = new Array(this.column).fill(0);
        }
        for (var i = 0; i < this.row * this.column; i++) {
            this.set_board(i, 0);
        }
    };
    BfTable.prototype.set_board = function (index, data) {
        var rc = this.index_to_rc(index);
        var n = rc[0];
        var m = rc[1];
        var padding_date = this.pad(data, this.disit_width);
        this.html_table.rows[n].cells[m].firstChild.data = padding_date;
        this.board[n][m] = data;
    };
    BfTable.prototype.get_board = function (index) {
        var rc = this.index_to_rc(index);
        var n = rc[0];
        var m = rc[1];
        return this.html_table.rows[n].cells[m].firstChild.data;
    };
    BfTable.prototype.ref = function (index) {
        var rc = this.index_to_rc(index);
        var n = rc[0];
        var m = rc[1];
        this.set_board(index, this.board[n][m]);
    };
    BfTable.prototype.pad = function (num, d) {
        var tmp = ('0'.repeat(d)) + String(num);
        var l = tmp.length;
        var res = tmp.slice(l - d, l);
        return res;
    };
    BfTable.prototype.index_to_rc = function (index) {
        var n = Math.floor(index / this.column);
        var m = index % this.column;
        return [n, m];
    };
    BfTable.prototype.color = function (index, color_code) {
        var rc = this.index_to_rc(index);
        var n = rc[0];
        var m = rc[1];
        this.html_table.rows[n].cells[m].style.backgroundColor = color_code;
    };
    return BfTable;
}());
var Interpreter = /** @class */ (function () {
    function Interpreter() {
        this.bracket = new Map(); // i番目の括弧に対応した括弧にindex
        this.stack = new Array(); // 
        this.head = 0; // bfのインタープリタのヘッドの位置
        this.size = 30000; // bfのメモリサイズ
        this.data = new Array(this.size); // bfのメモリ
        this.row = 3; // メモリ表示の行数
        this.column = 10; // メモリ表示の列数
        this.input_header = 0; // 入力のヘッダ
        this.source_index = 0; // bfコードの実行位置
        this.runnning = false; // 実行中ならtrue
        this.fps = 10; // step per second(実行の間隔)
        this.bt = new BfTable(this.row, this.column, document.getElementById('bf_board'));
    }
    Interpreter.prototype.reset = function () {
        this.data.fill(0);
        this.bt.reset();
        this.head = 0;
        this.input_header = 0;
        this.source_index = 0;
        if (this.output) {
            this.output.innerText = '';
        }
        this.setinterval = null;
        this.runnning = false;
    };
    Interpreter.prototype.set = function (bf_code, source, output, input) {
        this.bf_html = bf_code;
        this.source = source;
        this.output = output;
        this.input = input;
        this.init();
        this.data.fill(0);
    };
    Interpreter.prototype.init = function () {
        // source code
        var n = this.source.length;
        var cnt = 0;
        for (var i = 0; i < n; i++) {
            switch (this.source[i]) {
                case '[':
                    this.stack.push(i);
                    break;
                case ']':
                    if (warning && this.stack.length === 0) {
                        if (warning) {
                            throw new Error("WARNING: '[' is not enough");
                        }
                        else {
                            this.bracket.set(i, null);
                        }
                    }
                    else {
                        var left_index = this.stack.pop();
                        this.bracket.set(i, left_index);
                        this.bracket.set(left_index, i);
                    }
                    break;
                default:
                    break;
            }
        }
        if (this.stack.length !== 0) {
            throw new Error("ERROR: ']' is not enough");
        }
        // color init
        this.bt.color(0, '#ffa000');
        // input
        this.input_str = this.input.value;
    };
    Interpreter.prototype.color = function (index, color_code) {
        //この処理が重いO(|source|)
        var qs = document.getElementsByClassName("bf_code");
        var qse = Array.from(qs);
        if (qse.length > index) {
            qse[index].style.backgroundColor = color_code;
        }
    };
    Interpreter.prototype.proc_by_block = function (index) {
        switch (this.source[index]) {
            case '[':
                if (this.data[this.head] === 0) {
                    var right_index = this.bracket.get(index);
                    if (!!right_index) {
                        this.source_index = right_index; //参照渡しがないので、これの仕様を要検討
                    }
                }
                break;
            case ']':
                if (this.data[this.head] !== 0) {
                    var left_index = this.bracket.get(index);
                    if (!!left_index) {
                        this.source_index = left_index;
                    }
                }
                break;
            case '+':
                if (this.head < 0) {
                    throw new Error("ERROR: head move to negative and increment.");
                }
                this.data[this.head]++;
                if (this.data[this.head] >= 256) {
                    this.data[this.head] = 0;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '-':
                if (this.head < 0) {
                    throw new Error("ERROR: head move to negative and decrement.");
                }
                this.data[this.head]--;
                if (this.data[this.head] < 0) {
                    this.data[this.head] = 255;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '>':
                this.bt.color(this.head, '#ffffff');
                this.head++;
                this.bt.color(this.head, '#ffa000');
                break;
            case '<':
                this.bt.color(this.head, '#ffffff');
                this.head--;
                this.bt.color(this.head, '#ffa000');
                if (warning && this.head < 0) {
                    throw new Error("WARNING: head move to negative.");
                }
                break;
            case ',':
                if (this.input_header < this.input_str.length) {
                    this.data[this.head] = this.input_str.charCodeAt(this.input_header++);
                }
                else {
                    this.data[this.head] = 0;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '.':
                console.log(String.fromCharCode(this.data[this.head]));
                this.output.innerText += String.fromCharCode(this.data[this.head]);
                break;
            default:
                break;
        }
    };
    Interpreter.prototype.interpreter = function () {
        if (this.source_index < this.source.length) {
            this.color(this.source_index, '#ffffff');
            this.proc_by_block(this.source_index);
            this.source_index++;
            this.color(this.source_index, '#ffa000');
            return 0;
        }
        else {
            return 1;
        }
    };
    Interpreter.prototype.run = function () {
        var _this = this;
        this.runnning = true;
        this.setinterval = setInterval(function () {
            var fin = _this.interpreter();
            if (fin === 1) {
                _this.finish();
            }
        }, 1000 / this.fps);
    };
    Interpreter.prototype.change_fps = function (num) {
        var p = Math.pow(10, num);
        p = Math.floor(p);
        //console.log(p);
        this.fps = p;
        document.getElementById('fps').innerHTML = String(p);
        if (this.runnning) {
            clearInterval(this.setinterval);
            this.run();
        }
    };
    Interpreter.prototype.finish = function () {
        console.log('finish!');
        clearInterval(this.setinterval);
        this.runnning = false;
        this.fin_proc();
    };
    Interpreter.prototype.fin_proc = function () {
        var run = document.getElementById('run');
        var stop = document.getElementById('stop');
        run.disabled = false;
        stop.disabled = true;
    };
    Interpreter.prototype.resume = function () {
        this.run();
    };
    Interpreter.prototype.stop = function () {
        this.runnning = false;
        clearInterval(this.setinterval);
        //this.setinterval;
    };
    return Interpreter;
}());
function main() {
    var output = document.getElementById('output');
    var input = document.getElementById('input');
    input.value = '123';
    var run = document.getElementById('run');
    var source = document.getElementById('source');
    source.value = ',.,.,.[-]++++++++[>++++++<-]>.[-]<';
    var bf_code = document.getElementById('bf_code');
    var stop = document.getElementById('stop');
    var step = document.getElementById('step');
    var range = document.getElementById('range');
    var ip = new Interpreter();
    run.addEventListener('click', function () {
        // bf_code
        while (bf_code.firstChild) {
            bf_code.removeChild(bf_code.firstChild);
        }
        var n = source.value.length;
        for (var i = 0; i < n; i++) {
            var spn = document.createElement('span');
            spn.setAttribute('class', 'bf_code');
            spn.innerHTML = source.value[i];
            bf_code.appendChild(spn);
        }
        // interpreter
        ip.reset();
        ip.set(bf_code, source.value, output, input);
        ip.run();
        stop.disabled = false;
        run.disabled = true;
    });
    stop.addEventListener('click', function () {
        if (ip.runnning) {
            ip.stop();
            run.disabled = false;
            //stop.disabled=true;
            step.disabled = false;
        }
        else {
            ip.resume();
            stop.disabled = false;
            run.disabled = true;
        }
    });
    step.addEventListener('click', function () {
        ip.interpreter();
        //stop.disabled=false;
    });
    range.addEventListener('input', function () {
        //console.log(range.value);
        ip.change_fps(Number(range.value));
    });
}
