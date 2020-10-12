(()=>{
    window.onload=()=>{
        transpiler();
        main();
    };
})();

class TypeSpecifierManeger{
    typeSpec = new Map<string,number>();
    typeName = ["int","void","char","bool"];
    typeSize = [11,0,1,1]//bit数
    constructor(){
        for (let index = 0; index < this.typeName.length; index++) {
            const n = this.typeName[index];
            const s = this.typeSize[index];
            this.typeSpec.set(n,s);
        }
    }
    get(name:string):number{
        const res=this.typeSpec.get(name);
        if(res===undefined){
            throw new Error(`${name} not exist`);
        }
        return res;
    }
    exist(name:string):boolean{
        const tmp = this.typeSpec.get(name);
        let res = true;
        if(tmp===undefined){
            res = false;
        }
        return res;
    }
}

class MemoryManager{
    memory:number;  // 現在使用されてないメモリの先頭をさす(stack(FILO)を想定), 要変更
    tsm:TypeSpecifierManeger;
    constructor(){
        this.memory=0;
        this.tsm = new TypeSpecifierManeger();
    }
    require(sz:number):number{
        //const sz = this.tsm.get(name);
        const res = this.memory;
        this.memory += sz;
        return res;
    }
    free(sz:number){
        //const sz = this.tsm.get(name);
        this.memory -= sz; // LILOを想定
    }
}

class Various{
    typeName:string;    // 型名
    varName:string;     // 変数名
    value:any;          // 格納する値
    size:number;        // bfでのメモリの確保数
    position:number;    // bf上で確保するメモリの先頭の位置
    constructor(tn:string,vn:string){
        this.typeName = tn;
        this.varName = vn;
    }
    setSize(sz:number){
        this.size=sz;
    }
    setValue(value:any){
        this.value=value;
    }
    setPositon(pos:number){
        this.position=pos;
    }
}

class HeadManager{
    private head:number;
    constructor(){
        this.head=0;
    }
    move(position:number):string{
        const diff = position-this.head;
        let res = '';
        if(diff>0){
            res = '>'.repeat(diff);
        }else if(diff<0){
            res = '<'.repeat(Math.abs(diff));
        }
        this.head = position;
        return res;
    }
    getHead():number{
        return this.head;
    }
}

class Int{//10進数に分解して管理
    base=10;
    width=Math.ceil(32/Math.log2(this.base));
    assign_literal(num:number,position:number,hm:HeadManager){//代入先を初期化する必要がある
        let res = '';
        let restore = hm.getHead();
        //* init
        for(let i=0;i<this.width+1;i++){
            res += hm.move(position+i);
            res += '[-]';
        }
        //*/
        // positive/negative
        //let restore = hm.getHead();
        res+=hm.move(position);
        res+='[-]';
        if(num<0){
            res+='+';
        }
        res+=hm.move(restore);
        num = Math.abs(num);
        // add
        for(let i=0;i<this.width;i++){//big endian
            const t=num%this.base;
            //if(t>0){//初期化を含むためt>0ではだめ
                res += this.assign_literal_base(t,position-i+this.width,hm);//左端は符号
            //}
            num/=this.base;
        }
        //res += hm.move(restore);
        return res;
    }
    // _baseはセル一つに対する操作
    add_literal_base(num:number,position:number,hm:HeadManager){ // mem[position] += num
        let restore = hm.getHead();
        let move = hm.move(position);
        let assi = '+'.repeat(num);
        let rest = hm.move(restore);
        const res = move+assi+rest;
        return res;
    }
    sub_literal_base(num:number,position:number,hm:HeadManager){ // mem[position] -= num
        let restore = hm.getHead();
        let move = hm.move(position);
        let assi = '-'.repeat(num);
        let rest = hm.move(restore);
        const res = move+assi+rest;
        return res;
    }
    assign_literal_base(num:number,position:number,hm:HeadManager){ // mem[position] = num
        let restore = hm.getHead();
        let move = hm.move(position);
        let init = '[-]';
        let assi = '+'.repeat(num);
        let rest = hm.move(restore);
        const res = move+init+assi+rest;
        return res;
    }
    copy_base(position_from:number,position_to:number,hm:HeadManager,mm:MemoryManager){ // mem[to] = mem[from]
        let req = mm.require(1);
        let restore = hm.getHead();
        let move = hm.move(position_from);
        let copy1 = '[';
        copy1 += hm.move(position_to);
        copy1 += '+';
        copy1 += hm.move(req);
        copy1 += '+';
        copy1 += hm.move(position_from);
        copy1 += '-';
        copy1 += ']';
        //copy1 += '@';
        let copy2 = hm.move(req);
        copy2 += '[' + hm.move(position_from) + '+' + hm.move(req) + '-]';
        let res = move + copy1 + copy2;
        res += this.assign_literal_base(0,req,hm);
        res += hm.move(restore);
        mm.free(1);
        return res;
    }
    assign_various(positoin_from:number,position_to:number,hm:HeadManager,mm:MemoryManager){ // to = from
        let restore = hm.getHead(); // 関数の開始時のhead位置
        let to_init = ''; // toを初期化
        for(let i=0;i<this.width+1;i++){
            to_init += hm.move(position_to+i);
            to_init += '[-]';
        }
        //to_init += hm.move(position_to);
        //to_init += '[-]';
        let rest = hm.move(restore); // restoreの位置に復元
        let av = this.add_various(positoin_from,position_to,hm,mm); // to += from
        let res = to_init + rest + av; // to = 0, to+=from
        return res;
    }
    add_various(positoin_from:number,position_to:number,hm:HeadManager,mm:MemoryManager){ // to += from
        let req = mm.require(this.width+1); // fromを一時退避
        let restore = hm.getHead();
        let move = hm.move(positoin_from);
        let copy = '';
        for(let i=0;i<this.width+1;i++){
            copy += '[';
            copy += hm.move(position_to+i);
            copy += '+';
            copy += hm.move(req+i);
            copy += '+';
            copy += hm.move(positoin_from+i);
            copy += '-';
            copy += ']';
            copy += hm.move(positoin_from+i+1);
        }
        //ここまででtoと退避領域に移動
        let copy2 = '';
        copy2 += hm.move(req);
        for(let i=0;i<this.width+1;i++){
            copy2 += '[';
            copy2 += hm.move(positoin_from+i);
            copy2 += '+';
            copy2 += hm.move(req+i);
            copy2 += '-';
            copy2 += ']';
            copy2 += hm.move(req+i+1);
        }
        //ここまでで退避領域をfromに移動
        let rest = hm.move(restore);
        let res = move + copy　+ copy2 + rest;
        mm.free(this.width+1);
        return res;
    }
    sub_various(positoin_from:number,position_to:number,hm:HeadManager,mm:MemoryManager){ // to -= from
        let req = mm.require(this.width+1); // fromを一時退避
        let restore = hm.getHead();
        let move = hm.move(positoin_from);
        let copy = '';
        for(let i=0;i<this.width+1;i++){
            copy += '[';
            copy += hm.move(position_to+i);
            copy += '+';
            copy += hm.move(req+i);
            copy += '+';
            copy += hm.move(positoin_from+i);
            copy += '-';
            copy += ']';
            copy += hm.move(positoin_from+i+1);
        }
        //ここまででtoと退避領域に移動
        let copy2 = '';
        copy2 += hm.move(req);
        for(let i=0;i<this.width+1;i++){
            copy2 += '[';
            copy2 += hm.move(positoin_from+i);
            copy2 += '-';
            copy2 += hm.move(req+i);
            copy2 += '-';
            copy2 += ']';
            copy2 += hm.move(req+i+1);
        }
        //ここまでで退避領域をfromに移動
        let rest = hm.move(restore);
        let res = move + copy　+ copy2 + rest;
        mm.free(this.width+1);
        return res;
    }
    print_char(cha:string,hm:HeadManager,mm:MemoryManager):string{
        let res = '';
        let restore = hm.getHead();
        let req = mm.require(1);
        let code = cha.charCodeAt(0);
        res += this.assign_literal_base(code,req,hm);
        res += hm.move(req);
        res += '.';
        res += hm.move(req);
        res += '[-]';
        mm.free(1);
        res += hm.move(restore);
        return res;
    }
    print_disit(position:number,hm:HeadManager):string{
        let res = '';
        let restore = hm.getHead();
        res += hm.move(position);
        res += this.add_literal_base(48,position,hm);
        res += '.';
        res += this.sub_literal_base(48,position,hm);
        res += hm.move(restore);
        return res;
    }
    store_base(pos_from:number,pos_to:number,hm:HeadManager):string{ // pos_toからpos_fromへ退避(1セル,破壊的),pos_to=pos_from,pos_from=0
        let res = '';
        let restore = hm.getHead();
        res += hm.move(pos_from);
        res += '[';
        res += hm.move(pos_to);
        res += '+';
        res += hm.move(pos_from);
        res += '-';
        res += ']';
        res += hm.move(restore);
        return res;
    }
    equal_base(pos_from:number,pos_to:number,pos_rslt:number,hm:HeadManager,mm:MemoryManager):string{ // pos_rslt=pos_to==pos_from
        let res = '';
        let restore = hm.getHead();
        let req = mm.require(2);
        res += this.assign_literal_base(1,pos_rslt,hm);
        res += this.copy_base(pos_from,req,hm,mm);
        res += this.copy_base(pos_to,req+1,hm,mm);
        //res += '@';
        res += hm.move(req) + '[' + hm.move(req+1) + '-' + hm.move(req) + '-]';
        res += hm.move(req+1) + '[' + hm.move(pos_rslt) + '[-]'+ hm.move(req+1) + '[-]]';
        res += this.assign_literal_base(0,req,hm);
        res += this.assign_literal_base(0,req+1,hm);
        res += hm.move(restore);
        mm.free(2);
        return res;
    }
    shift_right(position:number,hm:HeadManager,mm:MemoryManager):string{ //論理右シフト(10進数)
        let res = '';
        let restore = hm.getHead();
        //let req = mm.require(1);
        //res += this.assign_literal_base(1,req,hm);
        //res += hm.move(position+1+this.width);
        //res += this.copy_base(position+this.width,req,hm,mm);
        for(let i=this.width-1;i>0;i--){
            const pos = position+i;
            res += hm.move(pos);
            res += '[>+<-]';
        }
        //res += hm.move(req);
        //res += '[' + hm.move(position+1) + '+' + hm.move(req) + '-]';
        res += hm.move(restore);
        return res;
    }
    print(position:number,hm:HeadManager,mm:MemoryManager):string{
        let res = '';
        let restore = hm.getHead();
        let req1 = mm.require(1);
        let req2 = mm.require(1);
        let req3 = mm.require(1);
        res += this.assign_literal_base(1,req2,hm);
        //let move = hm.move(position);
        let minus = hm.move(position);
        minus += '[';
        minus += this.print_char('-',hm,mm);
        //minus += hm.move(position);
        minus += '[-]';
        minus += ']';
        let output = '';
        for(let i=0;i<this.width;i++){
            // 既にnon 0が出現していたら問答無用で出力
            output += hm.move(req1);
            output += '[';
                //output += '@';
                output += this.print_disit(position+1+i,hm);
                //output += hm.move(req1);
                // req3にreq1を退避
                output += this.store_base(req1,req3,hm);
            output += ']';
            // req1にreq3を復元
            output += this.store_base(req3,req1,hm);
            // そうでないかつ0でないなら出力 and req1に1,req2に0をセット
            output += hm.move(req2);
            output += '[';
                // non 0
                output += hm.move(position+1+i);
                output += '[';
                output += this.print_disit(position+1+i,hm);
                output += this.assign_literal_base(1,req1,hm);
                output += this.assign_literal_base(0,req2,hm);
                output += this.store_base(position+1+i,req3,hm);
                output += ']';
                output += this.store_base(req3,position+1+i,hm);
                output += this.store_base(req2,req3,hm);
                output += hm.move(req2);
            output += ']';
            output += this.store_base(req3,req2,hm);
            //output += 'a';
        }
        // 一度も出力してない場合'0'を出力
        output += hm.move(req2);
        output += '[';
        output += this.print_char('0',hm,mm);
        output += '[-]';
        output += ']';
        res += minus + output;
        res += this.assign_literal_base(0,req1,hm);
        res += this.assign_literal_base(0,req2,hm);
        res += this.assign_literal_base(0,req3,hm);
        mm.free(3);
        res += hm.move(restore);
        return res;
    }
    println(position:number,hm:HeadManager,mm:MemoryManager):string{
        let res = '';
        let restore = hm.getHead();
        res += this.print(position,hm,mm);
        let req = mm.require(1);
        res += this.assign_literal_base(10,req,hm);
        res += hm.move(req);
        res += '.';
        res += this.assign_literal_base(0,req,hm);
        mm.free(1);
        res += hm.move(restore);
        return res;
    }
}


class VariousManager{
    tsm:TypeSpecifierManeger;
    mm:MemoryManager;
    vars:Map<string,Various>;
    constructor(mm:MemoryManager){
        this.tsm = new TypeSpecifierManeger();
        this.mm = mm;
        this.vars = new Map<string,Various>();
    }
    make(typeName:string,varName:string){ // 変数生成
        const tmp = new Various(typeName,varName);
        const sz = this.tsm.get(typeName);
        tmp.setSize(sz);
        const pos = this.mm.require(sz);
        tmp.setPositon(pos);
        this.vars.set(varName,tmp);
    }
    free(varName:string){ // 変数の解放
        const sz = this.vars.get(varName).size;
        this.mm.free(sz);
        this.vars.delete(varName);
    }
    get(varName:string):Various{
        return this.vars.get(varName);//error処理
    }
    exist(varName:string):boolean{
        const tmp = this.vars.get(varName);
        let res = true;
        if(tmp===undefined){
            res = false;
        }
        return res;
    }
}

class StackManager{
    hm:HeadManager;
    mm:MemoryManager;
    vm:VariousManager;
    tsm:TypeSpecifierManeger;
    stack_pos:Array<number>;
    stack_type:Array<string>;
    int:Int;
    result_name:string;
    constructor(hm:HeadManager,mm:MemoryManager,vm:VariousManager){
        this.hm = hm;
        this.mm = mm;
        this.vm = vm;
        this.tsm = new TypeSpecifierManeger();
        this.stack_pos = new Array<number>();
        this.stack_type = new Array<string>();
        this.int = new Int();
        this.result_name = '*result';
    }
    push(va:Various):string{ // <value,type>をメモリに格納
        const sz = this.tsm.get(va.typeName);
        const pos = this.mm.require(va.size);
        this.stack_pos.push(pos);
        this.stack_type.push(va.typeName);
        if(va.typeName==='int'){
            return this.int.assign_various(va.position,pos,this.hm,this.mm);
        }else{
            throw new Error('semantic error.');
        }
    }
    push_literal(value:number,type:string):string{ // <value,type>をメモリに格納
        const sz = this.tsm.get(type);
        const pos = this.mm.require(sz);
        this.stack_pos.push(pos);
        this.stack_type.push(type);
        return this.int.assign_literal(value,pos,this.hm);
    }
    pop():string{//stackの先頭を'*result'に格納
        const pos = this.stack_pos.pop();
        const type = this.stack_type.pop();
        const sz = this.tsm.get(type);
        let res = '';
        if(type==='int'){
            const to = this.vm.get(this.result_name).position;
            res += this.int.assign_various(pos,to,this.hm,this.mm);
        }else{
            throw new Error('semantic error.');
        }
        res += this.int.assign_literal(0,pos,this.hm); // 一連のpush,popで用いるstack領域が連続と仮定
        this.mm.free(sz);
        return res;
    }
    freeAll():string{
        let res = '';
        let pos = this.stack_pos.pop();
        let type = this.stack_type.pop()
        while(pos!==undefined){
            const sz = this.tsm.get(type);
            res += this.int.assign_literal(0,pos,this.hm);
            pos = this.stack_pos.pop();
            type = this.stack_type.pop();
        }
        return res;
    }
}


class LexicalAnalysis{
    source:string;
    constructor(inp:string){
        this.source=inp;
    }
    run():Array<string>{
       let tmp = this.source.split(/("(?:\\"|[^"])*?"|[A-Za-z_]+\w*|[\(\)\[\]\{\};,\s]|0|-?[1-9]+[0-9]*)/g);//文字リテラル|変数名|括弧類と区切り文字|0|0以外の整数
        let res = [];
        tmp.forEach(element => {
            let empty = (/\s/.test(element))||(element==='');
            if(!empty){
                res.push(element);
            }
        });
        return res;
    }
}


class SemanticAnalysis{
    //とりあえずスコープはなしとする
    pa:ParseAnalysis;
    hm:HeadManager;
    vm:VariousManager;
    mm:MemoryManager;
    sm:StackManager;
    result_name:string;
    result:Various;
    tmp_name:string;
    tmp:Various;
    int:Int;
    constructor(inp:ParseAnalysis,vm:VariousManager,hm:HeadManager,mm:MemoryManager,sm:StackManager){
        this.pa=inp;
        this.hm=hm;
        this.vm=vm;
        this.mm=mm;
        this.sm=sm;
        this.result_name='*result';
        this.vm.make('int',this.result_name); // 演算の結果を格納する内部変数(r10のようなもの)
        this.result = this.vm.get(this.result_name);
        this.tmp_name='*tmp';
        this.vm.make('int',this.tmp_name);
        this.tmp = this.vm.get(this.tmp_name);
        this.int = new Int();
    }
    run():string{
        //this.vm.make('int',this.result_name);
        let res = '';
        const st = this.pa.run();
        console.log(st);
        this.verify_type(st,'translation_unit');
        res += this.semantic_translation_unit(st);
        return res;
    }
    verify_type(st:SyntaxTree,expected:string):void{
        if(st.type!==expected){
            throw new Error(`expected type is ${expected}, but actually ${st.type}`)
        }
    }
    semantic_translation_unit(st:SyntaxTree):string{
        let res = '';
        st.children.forEach(v=>{
            this.verify_type(v,'statement');
            res += this.semantic_statement(v);
        });
        return res;
    }
    semantic_statement(st:SyntaxTree):string{
        let res = '';
        let ch0 = st.children[0];
        switch(ch0.type){
            case 'type_specifier':
                res += this.semantic_type_specifier(ch0);
                res += this.semantic_declarator(st.children[1],ch0.value);
                break;
            case 'exp':
                res += this.semantic_exp(ch0);
                res += this.sm.freeAll();
                break;
            case ';':
                break;
            case 'compound_statement':
                res += this.semantic_compound_statement(ch0);
                break;
            case 'print':
                res += this.semantic_print(st);
                break;
            case 'println':
                res += this.semantic_println(st);
                break;
            case 'read':
                res += this.semantic_read(st);
                break;
            default:
                throw new Error('semantic error.');
                break;
        }
        return res;
    }
    semantic_read(st:SyntaxTree):string{
        // 'read' IDENTIFIER
        let res = '';
        let restore = this.hm.getHead();
        const id_val = st.children[1].value;
        const id = this.vm.get(id_val);
        if(id.typeName==='int'){
            //とりあえず正整数と仮定する
            res += this.int.assign_literal(0,this.result.position,this.hm); // resultを0初期化
            // 入力が0,10,32のいずれかと等しい場合は、終了
            const cnt_req = 7;
            let req = this.mm.require(cnt_req);
            //res += this.hm.move(req+3);
            res += 'p';
            res += this.int.assign_literal_base( 1,req+0,this.hm);
            res += this.int.assign_literal_base( 0,req+1,this.hm);
            res += this.int.assign_literal_base(10,req+2,this.hm);
            res += this.int.assign_literal_base(32,req+3,this.hm);
            res += this.hm.move(req);
            for(let i=0;i<this.int.width;i++){
                res += '[';
                res += this.hm.move(this.result.position+1+i);
                res += ',';
                for(let j=0;j<3;j++){
                    res += this.int.equal_base(this.result.position+1+i,req+j+1,req+4,this.hm,this.mm);
                    res += this.hm.move(req+4);
                    res += '[' + this.hm.move(req) + '[-]' + this.hm.move(this.result.position+1+i) + '[-]' + this.hm.move(req+4) + '[-]]';
                }
                res += this.int.store_base(req,req+5,this.hm);
                res += this.hm.move(req);
                res += ']'
                res += this.int.store_base(req+5,req,this.hm);
            }
            //res += '@';
            const rightmost = this.result.position+this.int.width;
            res += this.int.assign_literal_base( 1,req+1,this.hm);
            res += this.int.assign_literal_base( 0,req+2,this.hm);
            //res += '@';
            res += this.hm.move(req+1);
            res += '[';
            res += this.hm.move(rightmost);
            res += '[' + this.hm.move(req+1) + '[-]' + this.int.store_base(rightmost,req,this.hm)+this.hm.move(rightmost)+']' + this.int.store_base(req,rightmost,this.hm);
            res += this.hm.move(req+1);
            res += '[' + this.int.shift_right(this.result.position,this.hm,this.mm) + this.int.store_base(req+1,req+2,this.hm) +']' + this.int.store_base(req+2,req+1,this.hm);
            res += ']';
            //res += this.hm.move(rightmost);
            //res += '[' + this.hm.move(req+1) + '[-]' + this.hm.move(rightmost) + '[-]]'
            //res += ']';
            for(let i=0;i<this.int.width;i++){
                let pos = this.result.position+1+i;
                res += this.hm.move(pos);
                res += '[' + this.int.sub_literal_base(48,pos,this.hm) + this.int.store_base(pos,req+6,this.hm) + ']' + this.int.store_base(req+6,pos,this.hm);
            }
            for(let i=0;i<cnt_req;i++){
                res += this.int.assign_literal_base(0,req+i,this.hm);
            }
            res += this.int.assign_various(this.result.position,id.position,this.hm,this.mm);
            res += this.hm.move(restore);
            this.mm.free(cnt_req);
        }else{
            throw new Error('semantic error.');
        }
        return res;
    }
    semantic_print(st:SyntaxTree):string{
        // 'print' exp
        let res = '';
        res += this.semantic_exp(st.children[1]); // expを評価
        res += this.sm.pop(); // 評価した値をresultに取り出す
        res += this.int.print(this.result.position,this.hm,this.mm); // resultに取り出した値を出力
        return res;
    }
    semantic_println(st:SyntaxTree):string{
        let res = '';
        res += this.semantic_exp(st.children[1]); // expを評価
        res += this.sm.pop(); // 評価した値をresultに取り出す
        res += this.int.println(this.result.position,this.hm,this.mm); // resultに取り出した値を出力
        return res;
    }
    semantic_compound_statement(st:SyntaxTree):string{
        let res = '';
        return res;
    }
    isLiteral(str:string):boolean{
        return str==='INT'|| str==='CHAR';
    }
    semantic_exp(st:SyntaxTree):string{
        let res = '';
        //let ch0 = st.children[0];
        if(st.children.length>1 && st.children[1].type==='binary_operator'){
            switch(st.children[1].value){
                case '=':
                    if(st.children[2].type==='exp'){
                        res += this.semantic_exp(st.children[2]);
                    }else if(st.children[2].type==='primary'){
                        res += this.semantic_primary(st.children[2]);
                    }else{
                        throw new Error('semantic error.');
                    }
                    res += this.sm.pop();
                    const from = this.result.position;
                    if(st.children[0].type!=='primary'){
                        throw new Error('semantic error.');
                    }
                    const to = this.vm.get(st.children[0].children[0].value).position;
                    res += this.int.assign_various(from,to,this.hm,this.mm);
                    res += this.sm.push(this.result);
                    break;
                case '+': // left + right
                    if(st.children[0].type==='exp'){
                        res += this.semantic_exp(st.children[0]);
                    }else if(st.children[0].type==='primary'){
                        res += this.semantic_primary(st.children[0]);
                    }
                    if(st.children[2].type==='exp'){
                        res += this.semantic_exp(st.children[2]);
                    }else if(st.children[2].type==='primary'){
                        res += this.semantic_primary(st.children[2]);
                    }else{
                        throw new Error('semantic error.');
                    }
                    res += this.sm.pop();   // rightの結果を*resultに格納
                    res += this.int.assign_various(this.result.position,this.tmp.position,this.hm,this.mm); // tmp = result
                    res += this.sm.pop();   // leftの結果を*resultに格納
                    res += this.int.add_various(this.tmp.position,this.result.position,this.hm,this.mm); // result += tmp
                    res += this.sm.push(this.result);
                    break;
                case '-':
                    if(st.children[0].type==='exp'){
                        res += this.semantic_exp(st.children[0]);
                    }else if(st.children[0].type==='primary'){
                        res += this.semantic_primary(st.children[0]);
                    }
                    if(st.children[2].type==='exp'){
                        res += this.semantic_exp(st.children[2]);
                    }else if(st.children[2].type==='primary'){
                        res += this.semantic_primary(st.children[2]);
                    }else{
                        throw new Error('semantic error.');
                    }
                    res += this.sm.pop();   // rightの結果を*resultに格納
                    res += this.int.assign_various(this.result.position,this.tmp.position,this.hm,this.mm); // tmp = result
                    res += this.sm.pop();   // leftの結果を*resultに格納
                    res += this.int.sub_various(this.tmp.position,this.result.position,this.hm,this.mm); // result -= tmp
                    res += this.sm.push(this.result);
                    break;
                case '*':
                    break;
                case '/':
                    break;
                case '<':
                    break;
                case '>':
                    break;
                case '&&':
                    break;
                case '||':
                    break;
                default:
                    throw new Error('semantic error.');
            }
        }else if(st.children[0].type==='unary_operator'){
            switch(st.children[0].value){
                case '&':
                case '*':
                case '+':
                case '-':
                case '!':
                    break;
                default:
                    throw new Error('semantic error.');
            }
        }else if(st.children[0].type==='('){

        }else if(st.children[0].type==='primary'){
            res += this.semantic_primary(st.children[0]);
        }else{
            throw new Error('semantic error.');
        }
        return res;
    }
    semantic_primary(st:SyntaxTree):string{
        /*let res = new Array<string>();
        res.push(''); // bf code
        res.push(''); // type
        res.push(''); // value
        res[0] = '';
        res[1] = st.children[0].type;
        res[2] = st.children[0].value;
        return res;*/
        let res = '';
        if(st.children[0].type==='INT'){
            const num:number = Number(st.children[0].value);
            res += this.sm.push_literal(num,'int');
        }else if(st.children[0].type==='IDENTIFIER'){
            const va = this.vm.get(st.children[0].value);
            res += this.sm.push(va);
        }
        return res;
    }
    semantic_type_specifier(st:SyntaxTree):string{
        let res = '';
        if(!this.vm.tsm.exist(st.value)){ // st.valueが型名として存在するか
            throw new Error(`'${st.value}' is not type name.`);
        }
        return res;
    }
    semantic_declarator(st:SyntaxTree,typeName:string):string{
        let res = '';
        this.vm.make(typeName,st.value);
        return res;
    }
    opt(str:string):string{
        let res = '';
        let count_left = 0;
        let count_right = 0;
        for(let i=0;i<str.length;i++){
            if(str[i]==='<'){
                if(count_right>0){
                    count_right--;
                }else{
                    count_left++;
                }
            }else if(str[i]=='>'){
                if(count_left>0){
                    count_left--;
                }else{
                    count_right++;
                }
            }else{
                res += '<'.repeat(count_left);
                res += '>'.repeat(count_right);
                res += str[i];
                count_left = 0;
                count_right = 0;
            }
        }
        //デバッグ用
        res += '<'.repeat(count_left);
        res += '>'.repeat(count_right);
        return res;
    }
}

class SyntaxTree{
    children:SyntaxTree[];
    value:any;
    type:string;
    constructor(){
        //this.value = val;
        this.children = new Array<SyntaxTree>();
    }
    setValue(val: any){
        this.value = val;
    }
    setType(type:string){
        this.type=type;
    }
}

class ParseAnalysis{
    lex:LexicalAnalysis;
    tsm:TypeSpecifierManeger;
    vm:VariousManager;
    //pvm:VariousManager; // parse時に用いるVariousManager
    hm:HeadManager;
    matrix = [[0,1,1,0,1],[0,0,1,0,1],[1,1,1,2,1],[0,0,-1,0,-1],[0,0,-1,0,-1]];
    op = new Map();
    index:number = 0;
    constructor(inp:LexicalAnalysis,vm:VariousManager,hm:HeadManager){
        this.lex=inp;
        this.tsm = new TypeSpecifierManeger();
        this.vm = vm;
        this.hm = hm;
        //this.pvm = new VariousManager();
        this.op.set('+',0);
        this.op.set('-',0);
        this.op.set('*',1);
        this.op.set('/',1);
        this.op.set('(',2);
        this.op.set(')',3);
    }
    isTerminalSynbol(str:string):boolean{
        let tmp = (/"(?:\\"|[^"])*?"|[A-Za-z_]+\w*|0|-?[1-9]+[0-9]*/.test(str)); // 再考
        return tmp;
    }
    isNonterminalSymbol(str:string):boolean{
        return !this.isTerminalSynbol(str);
        let tmp = /while|if|else|return|function|[\(\)\[\]\{\};,\s]/.test(str);
        return tmp;
    }
    verify(real:string,exp:string):SyntaxTree{
        if(exp!==real){
            throw new Error(`error: expected ${exp}, but actually ${real} at verify.`);
        }
        let res = new SyntaxTree();
        res.setType(exp);
        res.setValue(exp);
        return res;
    }
    parse(state:string,le:Array<string>):SyntaxTree{
        switch(state){
            case 'translation_unit':
                return this.parse_translation_unit(le);
            case 'type_specifier':
                return this.parse_type_specifier(le);
            case 'declarator':
                return this.parse_declarator(le);
            case 'exp':
                return this.parse_exp(le);
            case 'primary':
                return this.parse_primary(le);
            case 'unary_operator':
                return this.parse_unary_operator(le);
            case 'binary_operator':
                return this.parse_binary_operator(le);
            case 'statement':
                return this.parse_statement(le);
            case 'compound_statement':
                return this.parse_compound_statement(le);
            default:
                throw new Error(`error: '${state}' is unknown state.`);
        }
    }
    isINT(str:string):boolean{
        let res = (/^0$|^-?[1-9][0-9]*$/.test(str)); // -0を許容しない
        return res;
    }
    isIDENTIFIER(str:string):boolean{
        let res = (/^[A-Za-z_]+\w*$/.test(str));
        return res;
    }
    isEXP(str:string):boolean{
        return this.isINT(str)||this.isIDENTIFIER(str)||str==='(';
    }
    isTYPE(str:string):boolean{
        return str==='int'||str==='void'||str==='char'||str==='bool';
    }
    type_decl(res:SyntaxTree,le:Array<string>){
        let state = 'type_specifier';
        res.children.push(this.parse(state,le));
        this.index++;
        state = 'declarator';
        res.children.push(this.parse(state,le));
        this.index++;
        res.children.push(this.verify(le[this.index],';'));
    }
    is_binary_operator(str:string):boolean{
        return str==='='||str==='||'||str==='&&'||str==='<'||str==='>'||str==='+'||str==='-'||str==='*'||str==='/';
    }
    parse_binary_operator(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        if(!this.is_binary_operator(le[this.index])){
            throw new Error(`'${le[this.index]}' is not binary operator.`);
        }
        res.setType('binary_operator');
        res.setValue(le[this.index]);
        return res;
    }
    is_unary_operator(str:string):boolean{
        return str==='&'||str==='*'||str==='+'||str==='-'||str==='!';
    }
    parse_unary_operator(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        if(!this.is_unary_operator(le[this.index])){
            throw new Error(`'${le[this.index]}' is not unary operator.`);
        }
        res.setType('unary_operator');
        res.setValue(le[this.index]);
        return res;
    }
    parse_compound_statement(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('coumpound_statemnt');
        this.index++;
        res.children.push(this.verify(le[this.index],'{'));
        while(this.isTYPE(le[++this.index])){
            // type_specifier declarator ";"
            this.type_decl(res,le);
        }
        while(this.isTerminalSynbol(le[++this.index]) || this.isEXP(le[this.index])){
            let state = 'statement';
            this.parse(state,le);
        }
        this.index++;
        res.children.push(this.verify(le[this.index],'}'));
        return res;
    }
    parse_statement(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('statement');
        let state;
        
        if(this.isTYPE(le[this.index])){
            // type_specifier declarator ";"
            this.type_decl(res,le);
        }else if(le[this.index]==='if'){
            // "if" "(" exp ")" compound_statement
            res.children.push(this.verify(le[this.index],'if'));
            this.index++;
            res.children.push(this.verify(le[this.index],'('));
            this.index++;
            res.children.push(this.parse('exp',le));
            this.index++;
            res.children.push(this.verify(le[this.index],')'));
            this.index++;
            res.children.push(this.parse('compound_statement',le));
        }else if(le[this.index]==='while'){
            // "while" "(" exp ")" compound_statement
            res.children.push(this.verify(le[this.index],'while'));
            this.index++;
            res.children.push(this.verify(le[this.index],'('));
            this.index++;
            res.children.push(this.parse('exp',le));
            this.index++;
            res.children.push(this.verify(le[this.index],')'));
            this.index++;
            res.children.push(this.parse('compound_statement',le));
        }else if(le[this.index]==='print'){
            // "print' exp ";"
            res.children.push(this.verify(le[this.index],'print'));
            this.index++;
            res.children.push(this.parse('exp',le));
            this.index++;
            res.children.push(this.verify(le[this.index],';'));
        }else if(le[this.index]==='println'){
            // "println' exp ";"
            res.children.push(this.verify(le[this.index],'println'));
            this.index++;
            res.children.push(this.parse('exp',le));
            this.index++;
            res.children.push(this.verify(le[this.index],';'));
        }else if(le[this.index]==='read'){
            // "read" IDENTIFIER ";""
            res.children.push(this.verify(le[this.index],'read'));
            this.index++;
            if(!this.isIDENTIFIER(le[this.index])){
                throw new Error(`'${le[this.index]}' is not aceptable as a variable name`);
            }
            let tmp = new SyntaxTree();
            tmp.setType('IDENTIFIER');
            tmp.setValue(le[this.index]);
            res.children.push(tmp);
            this.index++;
            res.children.push(this.verify(le[this.index],';'));
        }else if(this.isEXP(le[this.index])){
            // exp ";"
            state = 'exp';
            res.children.push(this.parse(state,le));
            this.index++;
            res.children.push(this.verify(le[this.index],';'));
        }else if(le[this.index]===';'){
            // ";"
            res.children.push(this.verify(le[this.index],';'));
        }else if(le[this.index]==='{'){
            // compound_statement
            res.children.push(this.parse('compound_statement',le));
        }else{
            throw new Error(`error: unknown symbol '${le[this.index]}' at parse_statement`);
        }
        //this.index++;
        
        return res;
    }
    parse_type_specifier(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('type_specifier');
        res.setValue(le[this.index]);
        return res;
    }
    parse_declarator(le:Array<string>):SyntaxTree{
        if(!this.isIDENTIFIER(le[this.index])){
            throw new Error(`'${le[this.index]}' is not aceptable as a variable name`);
        }
        let res = new SyntaxTree();
        res.setType('declarator');
        res.setValue(le[this.index]);
        return res;
    }
    is_primary(str:string):boolean{
        return this.isINT(str)||this.isIDENTIFIER(str);
    }
    parse_exp(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('exp');
        //this.index++;
        if(this.is_primary(le[this.index])){
            // primary OR primary binary_opeartor exp
            res.children.push(this.parse('primary',le));
            if(this.is_binary_operator(le[this.index+1])){
                // binary_opeartor exp
                this.index++;
                if(!this.is_binary_operator(le[this.index])){
                    throw new Error(`'${le[this.index]}' is not binary operator.`);
                }
                res.children.push(this.parse('binary_operator',le));
                this.index++;
                if(!this.isEXP(le[this.index])){
                    throw new Error(`'${le[this.index]}' is not EXP.`);
                }
                res.children.push(this.parse('exp',le));
            }
        }else if(this.is_unary_operator(le[this.index])){
            // unary_opearor exp
            res.children.push(this.parse('unary_operator',le));
            this.index++;
            if(!this.isEXP(le[this.index])){
                throw new Error(`'${le[this.index]}' is not EXP.`);
            }
            res.children.push(this.parse('exp',le));
        }else if(this.isEXP(le[this.index])){
            // exp\{primary} binary_operator exp
            res.children.push(this.parse('exp',le));
            this.index++;
            if(!this.is_binary_operator(le[this.index])){
                throw new Error(`'${le[this.index]}' is not binary operator.`);
            }
            res.children.push(this.parse('binary_operator',le));
            this.index++;
            if(!this.isEXP(le[this.index])){
                throw new Error(`'${le[this.index]}' is not EXP.`);
            }
            res.children.push(this.parse('exp',le));
        }else if(le[this.index]==='('){
             // "(" exp ")"
             res.children.push(this.verify(le[this.index],'('));
             this.index++;
             res.children.push(this.parse('exp',le));
             this.index++;
             res.children.push(this.verify(le[this.index],')'));
        }else{
            throw new Error('parse error.');
        }
        //res.children.push(this.parse('primary',le));
        return res;
    }
    parse_primary(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('primary');
        //this.index++;
        if(this.isINT(le[this.index])){
            // INT
            let tmp = new SyntaxTree();
            tmp.setType('INT');
            tmp.setValue(le[this.index]);
            res.children.push(tmp);
        }else if(this.isIDENTIFIER(le[this.index])){
            // IDENTIFIER
            let tmp = new SyntaxTree();
            tmp.setType('IDENTIFIER');
            tmp.setValue(le[this.index]);
            res.children.push(tmp);
        }/*else if(le[this.index]==='('){
            // "(" exp ")"
            res.children.push(this.verify(le[this.index],'('));
            this.index++;
            res.children.push(this.parse('exp',le));
            this.index++;
            res.children.push(this.verify(le[this.index],')'));
        }*/
        else{
            throw new Error('parse error.');
        }
        return res;
    }
    parse_translation_unit(le:Array<string>):SyntaxTree{
        let res = new SyntaxTree();
        res.setType('translation_unit');
        while(this.index<le.length){
            //this.index++;
            res.children.push(this.parse('statement',le));
            this.index++;
        }
        return res;
    }
    run():SyntaxTree{
        const le = this.lex.run();
        let res = new SyntaxTree();
        let state = 'translation_unit';
        //let index = 0;
        res = this.parse(state,le);
        return res;
    }
}

class TranspileManager{
    source:string;      // 自作言語のソースコード
    la:LexicalAnalysis;
    pa:ParseAnalysis;
    sa:SemanticAnalysis;
    vm:VariousManager;
    hm:HeadManager;
    mm:MemoryManager;
    sm:StackManager;
    constructor(sce:string){
        this.source = sce;
        this.mm = new MemoryManager();
        this.vm = new VariousManager(this.mm);
        this.hm = new HeadManager();
        this.sm = new StackManager(this.hm,this.mm,this.vm);
        this.la = new LexicalAnalysis(this.source);
        this.pa = new ParseAnalysis(this.la,this.vm,this.hm);
        this.sa = new SemanticAnalysis(this.pa,this.vm,this.hm,this.mm,this.sm);
    }
    run():string{
        const tmp = this.sa.run();
        const res = this.sa.opt(tmp);
        return res;
    }
}

function transpiler(){
    const tbsource = document.getElementById('tb') as HTMLTextAreaElement;
    tbsource.value=
/**
`int a;
int b;
int c;

a = 10;
b = 15;
c = a + b;
println c;
`
/*/
`int a;
read a;
`
//*/
    const transpileButton = document.getElementById('transpile') as HTMLButtonElement;
    const tb_output = document.getElementById('tb_output') as HTMLDivElement;
    transpileButton.addEventListener('click',()=>{
        const str = tbsource.value;
        const tm = new TranspileManager(str);
        //tb_output.innerText=tm.run();
        const source = document.getElementById('source') as HTMLInputElement;
        source.value = tm.run();
        tm.vm.vars.forEach(v=>{
            console.log(v);
        });
    });
}