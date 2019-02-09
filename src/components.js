import Rete from 'rete';
import {
    TextInputControl,
    ImageSelectControl,
} from './Controls'

const anyTypeSocket = new Rete.Socket('Number value');
const typeMap = ["float", "vec2", "vec3", "vec4"];

class Expression extends Rete.Component {
    constructor(name, inputSocketNames, outputSocketName, expression) {
        super(name);
        this.inputSocketNames = inputSocketNames;
        this.outputSocketName = outputSocketName;
        this.expression = expression;
    }

    builder(node) {
        this.inputSocketNames.forEach((socketName) => {
            node.addInput(new Rete.Input(socketName, socketName, anyTypeSocket));
        });
        node.addOutput(new Rete.Output(this.outputSocketName, this.outputSocketName, anyTypeSocket));
        return node;
    }

    worker(node, inputs, outputs) {
        let inputVariableNames = {};
        for(let i = 0; i < this.inputSocketNames.length; ++ i) {
            let socketName = this.inputSocketNames[i];
            let input = inputs[socketName][0];
            if(input === undefined) {
                return;
            }
            inputVariableNames[socketName] = input.variableName;
        }

        let dimension = this.deriveOutputDimension(inputs);
        if(dimension > 0) {
            let variableName = this.name.toLowerCase() + "_" + node.id;
            outputs[this.outputSocketName] = {variableName, dimension};
            let statement = typeMap[dimension - 1] + " " + variableName + " = " + this.format(inputVariableNames);
            this.editor.nodes.find(n => n.id == node.id).material.appendSourceLine(statement);
        }
    }

    deriveOutputDimension(inputs) {
        return 0;
    }

    format(inputVariableNames) {
        let expression = this.expression;
        if(this.inputSocketNames.length > 0) {
            const regex = /%i/gi;
            let i = 0;
            let replacement = () => {
                return inputVariableNames[this.inputSocketNames[i ++]];
            };
            expression = expression.replace(regex, replacement);
        }
        return expression;
    }

}


class Arithmetic extends Expression {
    constructor(name, symbol) {
        super(name, ["a", "b"], "c", "%i " + symbol + " %i");
    }

    deriveOutputDimension(inputs) {
        let a = inputs["a"][0];
        let b = inputs["b"][0];
        if(a.dimension !== b.dimension && a.dimension !== 1 && b.dimension !== 1) {
            return 0;
        }
        return Math.max(a.dimension, b.dimension);
    }
};

export class Add extends Arithmetic {
    constructor() {
        super("Add", "+");
    }
};

export class Subtract extends Arithmetic {
    constructor() {
        super("Subtract", "-");
    }
};

export class Multiply extends Arithmetic {
    constructor() {
        super("Multiply", "*");
    }
};

export class Divide extends Arithmetic {
    constructor() {
        super("Divide", "/");
    }
};

export class Dot extends Expression {
    constructor() {
        super("Dot", ["a", "b"], "c", "dot(%i, %i)");
    }
    deriveOutputDimension(inputs) {
        let a = inputs["a"][0];
        let b = inputs["b"][0];
        if(a.dimension !== b.dimension) {
            return 0;
        }
        return 1;
    }
};

export class Cross extends Expression {
    constructor() {
        super("Cross", ["a", "b"], "c", "cross(%i, %i)");
    }
    deriveOutputDimension(inputs) {
        let a = inputs["a"][0];
        let b = inputs["b"][0];
        if(a.dimension !== b.dimension) {
            return 0;
        }
        return a.dimension;
    }
};

export class Mix extends Expression {
    constructor() {
        super("Mix", ["a", "b", "c"], "d", "mix(%i, %i ,%i)");
    }
    deriveOutputDimension(inputs) {
        let a = inputs["a"][0];
        let b = inputs["b"][0];
        let c = inputs["c"][0];
        if(a.dimension !== b.dimension || (c.dimension !== 1 && c.dimension !== a.dimension)) {
            return 0;
        }
        return a.dimension;
    }
};

class Constant extends Rete.Component {
    constructor(name, dimension) {
        super(name);
        this.dimension = dimension;
        this.formatChecker = (value) => {
            //todo: check format
            return true;
        };
    }

    builder(node) {
        node.addOutput(new Rete.Output("v", "v", anyTypeSocket));
        node.addControl(new TextInputControl("value", this.editor, this.formatChecker));
        return node;
    }

    worker(node, inputs, outputs) {
        let value = node.data.value;
        if(value === undefined) {
            return;
        }
        let variableName = this.name.toLowerCase() + "_" + node.id;
        outputs["v"] = {dimension: this.dimension, variableName};
        let type = typeMap[this.dimension - 1];
        if(this.dimension > 1) {
            value = type + "(" + value + ")";
        }
        let statement = type + " " + variableName + " = " + value;
        this.editor.nodes.find(n => n.id == node.id).material.appendSourceLine(statement);
    }

};

export class ConstantFloat extends Constant {
    constructor() {
        super("ConstantFloat", 1);
    }
};

export class ConstantVector2 extends Constant {
    constructor() {
        super("ConstantVector2", 2);
    }
};

export class ConstantVector3 extends Constant {
    constructor() {
        super("ConstantVector3", 3);
    }
};

export class ConstantVector4 extends Constant {
    constructor() {
        super("ConstantVector4", 4);
    }
};

export class Geometry extends Rete.Component {
    constructor() {
        super("Geometry");
    }

    builder(node) {
        node.addOutput(new Rete.Output("position", "position", anyTypeSocket));
        node.addOutput(new Rete.Output("normal", "normal", anyTypeSocket));
        node.addOutput(new Rete.Output("tangent", "tangent", anyTypeSocket));
        node.addOutput(new Rete.Output("binormal", "binormal", anyTypeSocket));
        node.addOutput(new Rete.Output("uv0", "uv0", anyTypeSocket));
        return node;
    }

    worker(node, inputs, outputs) {
        outputs["position"] = {dimension: 3, variableName: "v_position"};
        outputs["normal"] = {dimension: 3, variableName: "v_normal"};
        outputs["tangent"] = {dimension: 3, variableName: "v_tangent"};
        outputs["binormal"] = {dimension: 3, variableName: "v_binormal"};
        outputs["uv0"] = {dimension: 2, variableName: "v_uv0"};
    }
};

export class FragColor extends Rete.Component {
    constructor() {
        super("FragColor");
    }

    builder(node) {
        node.addInput(new Rete.Input("color", "color", anyTypeSocket));
        return node;
    }

    worker(node, inputs, outputs) {
        let color = inputs["color"][0];
        let statement;
        if(color !== undefined && color.dimension === 4) {
            statement = "gl_FragColor = " + color.variableName;
        }
        else {
            statement = "gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0)";
        }
        this.editor.nodes.find(n => n.id == node.id).material.appendSourceLine(statement);
    }
};

class Script extends Rete.Component {
    constructor(name) {
        super("Script");
    }

    builder(node) {

    }

    worker(node, inputs, outputs) {

    }

    static compile(source) {
        let functionName;
        let parameters = [];
        let returnedDimension;
        let compiledSource;
    }
};


export class Texture extends Rete.Component {
    constructor() {
        super("Texture");
    }

    builder(node) {
        node.addInput(new Rete.Input("uv", "uv", anyTypeSocket));
        node.addOutput(new Rete.Output("color", "color", anyTypeSocket));
        node.addOutput(new Rete.Output("r", "r", anyTypeSocket));
        node.addOutput(new Rete.Output("g", "g", anyTypeSocket));
        node.addOutput(new Rete.Output("b", "b", anyTypeSocket));
        node.addOutput(new Rete.Output("a", "a", anyTypeSocket));
        node.addControl(new ImageSelectControl("textureMap", this.editor));
        return node;
    }

    worker(node, inputs, outputs) {
        let uv = inputs["uv"][0];
        if(uv === undefined || uv.dimension !== 2) {
            return;
        }
        if(node.data.textureMap === undefined) {
            //return;
        }
        
        let samplerName = this.name.toLowerCase() + "_" + node.id;
        let uniform = "uniform sampler2D " + samplerName;
        let variableName = samplerName + "_color";
        let statement = "vec4 " + variableName + " = texture2D(" + samplerName + ", " + uv.variableName + ")";
        let material = this.editor.nodes.find(n => n.id == node.id).material;
        material.appendSourceLine(statement);
        material.appendUniformLine(uniform);
        outputs["color"] = {dimension: 4, variableName};
        outputs["r"] = {dimension: 1, variableName: variableName + ".r"};
        outputs["g"] = {dimension: 1, variableName: variableName + ".g"};
        outputs["b"] = {dimension: 1, variableName: variableName + ".b"};
        outputs["a"] = {dimension: 1, variableName: variableName + ".a"};
    }
};

export class NormalMap extends Texture {
    constructor() {

    }

    builder(node) {

    }

    worker(node, inputs, outputs) {

    }    
};