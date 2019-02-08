import Rete from 'rete';

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

        let dimension = deriveOutputDimension(inputs);
        if(dimension > 0) {
            let variableName = this.name.toLowerCase() + "_" + node.id;
            outputs[outputSocketName] = {variableName, dimension};
            let statement = typeMap[dimension - 1] + " " + variableName + " = " + format(inputVariableNames) + ";\n";
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
    constructor(dimension) {

    }

    builder(node) {

    }

    worker(node, inputs, outputs) {

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
        if(color !== undefined) {
            statement = "gl_FragColor = " + color.variableName + ";\n";
        }
        else {
            statement = "gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n";
        }
    }
};