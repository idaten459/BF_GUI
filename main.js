(() => {
    window.onload = () => {
        console.log("b");
        //main();
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
const warning = false;
function set_table(table, n, m, data) {
    table.rows[n].cells[m].firstChild.data = data;
}
function get_table(table, n, m) {
    return table.rows[n].cells[m].firstChild.data;
}
class BfTable {
    constructor(row, column, html_table) {
        this.disit_width = 3;
        this.row = row;
        this.column = column;
        this.board = new Array(row);
        for (let i = 0; i < row; i++) {
            this.board[i] = new Array(column).fill(0);
        }
        this.html_table = html_table;
    }
    reset() {
        for (let i = 0; i < this.row; i++) {
            this.board[i] = new Array(this.column).fill(0);
        }
        for (let i = 0; i < this.row * this.column; i++) {
            this.set_board(i, 0);
        }
    }
    set_board(index, data) {
        const rc = this.index_to_rc(index);
        const n = rc[0];
        const m = rc[1];
        const padding_date = this.pad(data, this.disit_width);
        this.html_table.rows[n].cells[m].firstChild.data = padding_date;
        this.board[n][m] = data;
    }
    get_board(index) {
        const rc = this.index_to_rc(index);
        const n = rc[0];
        const m = rc[1];
        return this.html_table.rows[n].cells[m].firstChild.data;
    }
    ref(index) {
        const rc = this.index_to_rc(index);
        const n = rc[0];
        const m = rc[1];
        this.set_board(index, this.board[n][m]);
    }
    pad(num, d) {
        const tmp = ('0'.repeat(d)) + String(num);
        const l = tmp.length;
        const res = tmp.slice(l - d, l);
        return res;
    }
    index_to_rc(index) {
        const n = Math.floor(index / this.column);
        const m = index % this.column;
        return [n, m];
    }
    color(index, color_code) {
        const rc = this.index_to_rc(index);
        const n = rc[0];
        const m = rc[1];
        this.html_table.rows[n].cells[m].style.backgroundColor = color_code;
    }
}
class Interpreter {
    constructor() {
        this.bracket = new Map(); // i番目の括弧に対応した括弧にindex
        this.stack = new Array(); // 
        this.head = 0; // bfのインタープリタのヘッドの位置
        this.size = 30000; // bfのメモリサイズ
        this.data = new Array(this.size); // bfのメモリ
        this.row = 13; // メモリ表示の行数
        this.column = 11; // メモリ表示の列数
        this.input_header = 0; // 入力のヘッダ
        this.source_index = 0; // bfコードの実行位置
        this.runnning = false; // 実行中ならtrue
        this.fps = 10; // step per second(実行の間隔)
        this.bt = new BfTable(this.row, this.column, document.getElementById('bf_board'));
    }
    reset() {
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
    }
    set(bf_code, source, output, input) {
        this.bf_html = bf_code;
        this.source = source;
        this.output = output;
        this.input = input;
        this.init();
        this.data.fill(0);
    }
    init() {
        // source code
        const n = this.source.length;
        let cnt = 0;
        for (let i = 0; i < n; i++) {
            switch (this.source[i]) {
                case '[':
                    this.stack.push(i);
                    break;
                case ']':
                    if (warning && this.stack.length === 0) {
                        if (warning) {
                            throw new Error(`WARNING: '[' is not enough`);
                        }
                        else {
                            this.bracket.set(i, null);
                        }
                    }
                    else {
                        const left_index = this.stack.pop();
                        this.bracket.set(i, left_index);
                        this.bracket.set(left_index, i);
                    }
                    break;
                default:
                    break;
            }
        }
        if (this.stack.length !== 0) {
            throw new Error(`ERROR: ']' is not enough`);
        }
        // color init
        this.bt.color(0, '#ffa000');
        // input
        this.input_str = this.input.value;
    }
    color(index, color_code) {
        //この処理が重いO(|source|)
        const qs = document.getElementsByClassName(`bf_code`);
        const qse = Array.from(qs);
        if (qse.length > index) {
            qse[index].style.backgroundColor = color_code;
        }
    }
    proc_by_block(index) {
        switch (this.source[index]) {
            case '[':
                if (this.data[this.head] === 0) {
                    const right_index = this.bracket.get(index);
                    if (!!right_index) {
                        this.source_index = right_index; //参照渡しがないので、これの仕様を要検討
                    }
                }
                break;
            case ']':
                if (this.data[this.head] !== 0) {
                    const left_index = this.bracket.get(index);
                    if (!!left_index) {
                        this.source_index = left_index;
                    }
                }
                break;
            case '+':
                if (this.head < 0) {
                    throw new Error(`ERROR: head move to negative and increment.`);
                }
                this.data[this.head]++;
                if (this.data[this.head] >= 256) {
                    this.data[this.head] = 0;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '-':
                if (this.head < 0) {
                    throw new Error(`ERROR: head move to negative and decrement.`);
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
                    throw new Error(`WARNING: head move to negative.`);
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
            case '@':// button関連がバグる
                this.stop();
                //run.disabled=false;
                //step.disabled=false;
                break;
            default:
                break;
        }
    }
    proc_by_block_opt(index) {
        switch (this.source[index]) {
            case '[':
                if (this.data[this.head] === 0) {
                    const right_index = this.bracket.get(index);
                    if (!!right_index) {
                        this.source_index = right_index; //参照渡しがないので、これの仕様を要検討
                    }
                }
                break;
            case ']':
                if (this.data[this.head] !== 0) {
                    const left_index = this.bracket.get(index);
                    if (!!left_index) {
                        this.source_index = left_index;
                    }
                }
                break;
            case '+':
                if (this.head < 0) {
                    throw new Error(`ERROR: head move to negative and increment.`);
                }
                this.data[this.head]++;
                if (this.data[this.head] >= 256) {
                    this.data[this.head] = 0;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '-':
                if (this.head < 0) {
                    throw new Error(`ERROR: head move to negative and decrement.`);
                }
                this.data[this.head]--;
                if (this.data[this.head] < 0) {
                    this.data[this.head] = 255;
                }
                this.bt.set_board(this.head, this.data[this.head]);
                break;
            case '>':
                this.bt.color(this.head, '#ffffff');
                while (this.source[this.source_index++] === '>') {
                    this.head++;
                }
                this.source_index -= 2;
                //this.head++;
                this.bt.color(this.head, '#ffa000');
                break;
            case '<':
                this.bt.color(this.head, '#ffffff');
                while (this.source[this.source_index++] === '<') {
                    this.head--;
                }
                this.source_index -= 2;
                //this.head--;
                this.bt.color(this.head, '#ffa000');
                if (warning && this.head < 0) {
                    throw new Error(`WARNING: head move to negative.`);
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
            case '@':// button関連がバグる
                this.stop();
                //run.disabled=false;
                //step.disabled=false;
                break;
            default:
                break;
        }
    }
    interpreter() {
        if (this.source_index < this.source.length) {
            this.color(this.source_index, '#ffffff');
            this.proc_by_block_opt(this.source_index);
            this.source_index++;
            this.color(this.source_index, '#ffa000');
            return 0;
        }
        else {
            return 1;
        }
    }
    run() {
        this.runnning = true;
        this.setinterval = setInterval(() => {
            const fin = this.interpreter();
            if (fin === 1) {
                this.finish();
            }
        }, 1000 / this.fps);
    }
    change_fps(num) {
        let p = Math.pow(10, num);
        p = Math.floor(p);
        //console.log(p);
        this.fps = p;
        document.getElementById('fps').innerHTML = String(p);
        if (this.runnning) {
            clearInterval(this.setinterval);
            this.run();
        }
    }
    finish() {
        console.log('finish!');
        clearInterval(this.setinterval);
        this.runnning = false;
        this.fin_proc();
    }
    fin_proc() {
        const run = document.getElementById('run');
        const stop = document.getElementById('stop');
        run.disabled = false;
        stop.disabled = true;
    }
    resume() {
        this.run();
    }
    stop() {
        this.runnning = false;
        clearInterval(this.setinterval);
        //this.setinterval;
    }
}
function main() {
    console.log("a");
    const output = document.getElementById('output');
    const input = document.getElementById('input');
    input.value = '123';
    const run = document.getElementById('run');
    const source = document.getElementById('source');
    source.value = ',.,.,.[-]++++++++[>++++++<-]>.[-]<';
    const bf_code = document.getElementById('bf_code');
    const stop = document.getElementById('stop');
    const step = document.getElementById('step');
    const range = document.getElementById('range');
    const ip = new Interpreter();
    const printOutput = true;
    run.addEventListener('click', () => {
        // bf_code
        while (bf_code.firstChild) {
            bf_code.removeChild(bf_code.firstChild);
        }
        /*
        const n=source.value.length;
        for(let i=0;i<n;i++){
            const spn=document.createElement('span');
            spn.setAttribute('class','bf_code');
            spn.innerHTML=source.value[i];
            if(printOutput){
                bf_code.appendChild(spn);
            }
            
        }*/
        bf_code.innerHTML = source.value;
        // interpreter
        ip.reset();
        ip.set(bf_code, source.value, output, input);
        ip.run();
        stop.disabled = false;
        run.disabled = true;
    });
    stop.addEventListener('click', () => {
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
    step.addEventListener('click', () => {
        ip.interpreter();
        //stop.disabled=false;
    });
    range.addEventListener('input', () => {
        //console.log(range.value);
        ip.change_fps(Number(range.value));
    });
}
//# sourceMappingURL=main.js.map