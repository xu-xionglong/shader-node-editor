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
            this.editor.materialWriter.appendFragmentSourceLine(statement);
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
            let numbers = value.split(",");
            if(numbers.length !== this.dimension) {
                return false;
            }
            let pattern
            if(numbers.length === 1) {
                pattern = /^(-?\d+)(\.\d+)$/;
            }
            else {
                pattern = /^(-?\d+)(\.\d+)?$/;
            }
            for(let i = 0; i < numbers.length; ++ i) {
                let numberStr = numbers[i];
                let matchedString = pattern.exec(numberStr);
                if(matchedString === null || matchedString[0] !== numberStr) {
                    return false;
                }
            }
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
        this.editor.materialWriter.appendFragmentSourceLine(statement);
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
        node.addOutput(new Rete.Output("uv0", "uv0", anyTypeSocket));
        return node;
    }

    worker(node, inputs, outputs) {
        outputs["position"] = {dimension: 3, variableName: "vViewPosition"};
        outputs["normal"] = {dimension: 3, variableName: "normal"};
        outputs["uv0"] = {dimension: 2, variableName: "vUv"};

        if(node.outputs.normal.connections.length > 0) {
            this.editor.materialWriter.enableNormal = true;
        }
        if(node.outputs.uv0.connections.length > 0) {
            this.editor.materialWriter.enableUV = true;
        }
        if(node.outputs.position.connections.length > 0) {
            this.editor.materialWriter.enablePosition = true;
        }
    }
};

export class FragColor extends Rete.Component {
    constructor() {
        super("FragColor");
    }

    builder(node) {
        node.addInput(new Rete.Input("color", "color", anyTypeSocket));
        node.addInput(new Rete.Input("alpha", "alpha", anyTypeSocket));
        return node;
    }

    worker(node, inputs, outputs) {
        let color = inputs["color"][0];
        let alpha = inputs["alpha"][0];
        let alphaValid = alpha !== undefined && alpha.dimension === 1;
        let statement;
        if(color !== undefined && color.dimension >= 3) {
            if(alphaValid) {
                if(color.dimension === 3) {
                    statement = "gl_FragColor = vec4(" + color.variableName + ", " + alpha.variableName + ")";
                }
                else {
                    statement = "gl_FragColor = vec4(" + color.variableName + ".rgb, " + alpha.variableName + ")"; 
                }
            }
            else {
                if(color.dimension === 3) {
                    statement = "gl_FragColor = vec4(" + color.variableName + ", 1.0)";
                }
                else {
                    statement = "gl_FragColor = " + color.variableName;
                }
            }
        }
        else {
            statement = "gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0)";
        }
        this.editor.materialWriter.appendFragmentSourceLine(statement);
    }
};

class UserScript extends Rete.Component {
    constructor(name) {
        super("UserScript");
    }


};


export class Texture extends Rete.Component {
    constructor() {
        super("Texture");
    }

    builder(node) {
        node.addInput(new Rete.Input("uv", "uv", anyTypeSocket));
        node.addOutput(new Rete.Output("rgba", "rgba", anyTypeSocket));
        node.addOutput(new Rete.Output("r", "r", anyTypeSocket));
        node.addOutput(new Rete.Output("g", "g", anyTypeSocket));
        node.addOutput(new Rete.Output("b", "b", anyTypeSocket));
        node.addOutput(new Rete.Output("a", "a", anyTypeSocket));
        node.addOutput(new Rete.Output("rgb", "rgb", anyTypeSocket));
        node.addControl(new ImageSelectControl(this.name.toLowerCase() + "_" + node.id, this.editor));
        
        return node;
    }

    worker(node, inputs, outputs) {
        let uv = inputs["uv"][0];
        if(uv === undefined || uv.dimension !== 2) {
            return;
        }
        
        let samplerName = this.name.toLowerCase() + "_" + node.id;
        let uniform = "uniform sampler2D " + samplerName;
        let variableName = "color_" + node.id;
        let statement = `vec4 ${variableName} = texture2D(${samplerName}, ${uv.variableName})`;
        let material = this.editor.materialWriter;
        material.appendFragmentSourceLine(statement);
        material.appendFragmentUniformLine(uniform);
        outputs["rgba"] = {dimension: 4, variableName};
        outputs["r"] = {dimension: 1, variableName: variableName + ".r"};
        outputs["g"] = {dimension: 1, variableName: variableName + ".g"};
        outputs["b"] = {dimension: 1, variableName: variableName + ".b"};
        outputs["a"] = {dimension: 1, variableName: variableName + ".a"};
        outputs["rgb"] = {dimension: 3, variableName: variableName + ".rgb"};
    }
};

export class NormalMap extends Rete.Component {
    constructor() {
        super("NormalMap");
    }

    builder(node) {
        node.addInput(new Rete.Input("uv", "uv", anyTypeSocket));
        node.addInput(new Rete.Input("normalScale", "normalScale", anyTypeSocket));
        node.addOutput(new Rete.Output("normal", "normal", anyTypeSocket));
        node.addControl(new ImageSelectControl(this.name.toLowerCase() + "_" + node.id, this.editor));
        return node;
    }

    worker(node, inputs, outputs) {
        let uv = inputs["uv"][0];
        let normalScale = inputs["normalScale"][0];
        if(uv === undefined || uv.dimension !== 2) {
            return;
        }
        if(normalScale !== undefined && normalScale.dimension !== 1) {
            return;
        }
        let samplerName = this.name.toLowerCase() + "_" + node.id;
        let uniform = "uniform sampler2D " + samplerName;
        let variableName = `normal_${node.id}`;
        let statement = `vec3 ${variableName} = perturbNormal2Arb(vViewPosition, normal, texture2D(${samplerName}, ${uv.variableName}).xyz, ${normalScale !== undefined ? normalScale.variableName : "1.0"})`;
        let material = this.editor.materialWriter;
        material.appendFragmentSourceLine(statement);
        material.appendFragmentUniformLine(uniform);
        material.enableNormal = true;
        material.enablePosition = true;
        material.enableNormalMap = true;
        outputs["normal"] = {dimension: 3, variableName};
    }    
};

export class Cloth extends Rete.Component {
    constructor() {
        super("Cloth");
    }

    builder(node) {
        node.addInput(new Rete.Input("baseColor", "baseColor", anyTypeSocket));
        node.addInput(new Rete.Input("roughness", "roughness", anyTypeSocket));
        node.addInput(new Rete.Input("normal", "normal", anyTypeSocket));
        node.addOutput(new Rete.Output("color", "color", anyTypeSocket));
    }

    worker(node, inputs, outputs) {
        let baseColor = inputs["baseColor"][0];
        let normal = inputs["normal"][0];
        let roughness = inputs["roughness"][0];
        let necessaryInputs = [
            baseColor,
            normal,
            roughness
        ];
        for(let i = 0; i < necessaryInputs.length; ++ i) {
            if(necessaryInputs[i] === undefined) {
                return;
            }
        }
        let material = this.editor.materialWriter;
        material.enableLight = true;
        material.enablePosition = true;
        material.enableFresnel = true;
        let functionSource = `
struct ClothMaterial
{
    vec3 baseColor;
    vec3 normal;
    float roughness;
    vec3 sheenColor;
};

float D_Charlie(float alpha, float dotNH) {
    float invAlpha  = 1.0 / alpha;
    float cos2h = dotNH * dotNH;
    float sin2h = max(1.0 - cos2h, 0.0078125);
    return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) * (0.5 * RECIPROCAL_PI);
}

float V_Neubelt(float dotNV, float dotNL) {
    return min(1.0 / (4.0 * (dotNL + dotNV - dotNL * dotNV)), 65504.0);
}

void redirectCloth(const in ClothMaterial material, const in IncidentLight incidentLight, inout ReflectedLight reflectedLight)
{
    float alpha = material.roughness * material.roughness;
    vec3 viewDir = normalize(-vViewPosition);
    vec3 halfDir = normalize(incidentLight.direction + viewDir);
    vec3 f0 = material.sheenColor;
    float dotNL = clamp(dot(material.normal, incidentLight.direction), 0.0, 1.0);
    float dotNV = clamp(dot(material.normal, viewDir), 0.0, 1.0);
    float dotNH = clamp(dot(material.normal, halfDir), 0.0, 1.0);
    float dotLH = clamp(dot(incidentLight.direction, halfDir), 0.0, 1.0);

    vec3 F = F_Schlick(f0, dotLH);
    float G = V_Neubelt(dotNV, dotNL);
    float D = D_Charlie(alpha, dotNH);
    reflectedLight.directSpecular += F * (G * D) * incidentLight.color * dotNL;

    reflectedLight.directDiffuse += material.baseColor * incidentLight.color * dotNL;
}

vec3 cloth(const in ClothMaterial material)
{
    IncidentLight incidentLight;
    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
#if (NUM_DIR_LIGHTS > 0)
    DirectionalLight directionalLight;
    #pragma unroll_loop
    for(int i = 0; i < NUM_DIR_LIGHTS; i ++) {
        directionalLight = directionalLights[i];
        incidentLight.direction = directionalLight.direction;
        incidentLight.color = directionalLight.color;
        redirectCloth(material, incidentLight, reflectedLight);
    }
#endif
    return reflectedLight.directDiffuse + reflectedLight.directSpecular + reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
}
`
        let variableName = this.name.toLowerCase() + "_" + node.id;
        let statement = `ClothMaterial clothMaterial;
    clothMaterial.baseColor = ${baseColor.variableName};
    clothMaterial.normal = ${normal.variableName};
    clothMaterial.roughness = ${roughness.variableName};
    clothMaterial.sheenColor = sqrt(clothMaterial.baseColor);
    vec3 ${variableName} = cloth(clothMaterial)`;

        material.appendFragmentSourceLine(statement);
        material.fragmentFunctionChunk += functionSource;
        outputs["color"] = {dimension: 3, variableName};
    }
};


export class Standard extends Rete.Component {
    constructor() {
        super("Standard");
    }

    builder(node) {
        node.addInput(new Rete.Input("baseColor", "baseColor", anyTypeSocket));
        node.addInput(new Rete.Input("metalness", "metalness", anyTypeSocket));
        node.addInput(new Rete.Input("roughness", "roughness", anyTypeSocket));
        node.addInput(new Rete.Input("reflectance", "reflectance", anyTypeSocket));
        //node.addInput(new Rete.Input("clearCoat", "clearCoat", anyTypeSocket));
        //node.addInput(new Rete.Input("clearCoatRoughness", "clearCoatRoughness", anyTypeSocket));
        //node.addInput(new Rete.Input("anisotropy", "anisotropy", anyTypeSocket));
        //node.addInput(new Rete.Input("anisotropyDirection", "anisotropyDirection", anyTypeSocket));
        //node.addInput(new Rete.Input("ambientOcclusion", "ambientOcclusion", anyTypeSocket));
        //node.addInput(new Rete.Input("emissive", "emissive", anyTypeSocket));
        node.addInput(new Rete.Input("normal", "normal", anyTypeSocket));
        node.addOutput(new Rete.Output("color", "color", anyTypeSocket));
    }

    worker(node, inputs, outputs) {
        let baseColor = inputs["baseColor"][0];
        let normal = inputs["normal"][0];
        let metalness = inputs["metalness"][0];
        let roughness = inputs["roughness"][0];
        let reflectance = inputs["reflectance"][0];
        //let clearCoat = inputs["clearCoat"][0];
        //let clearCoatRoughness = inputs["clearCoatRoughness"][0];
        //let anisotropy = inputs["anisotropy"][0];
        //let anisotropyDirection = inputs["anisotropyDirection"][0];
        //let ambientOcclusion = inputs["ambientOcclusion"][0];
        //let emissive = inputs["emissive"][0];
        let necessaryInputs = [
            baseColor,
            normal,
            metalness,
            roughness,
            reflectance
        ];
        for(let i = 0; i < necessaryInputs.length; ++ i) {
            if(necessaryInputs[i] === undefined) {
                return;
            }
        }
        let material = this.editor.materialWriter;
        material.enableLight = true;
        material.enablePosition = true;
        material.enableFresnel = true;
        let functionSource = `
struct StandardMaterial
{
    vec3 baseColor;
    float metalness;
    vec3 normal;
    float roughness;
    float reflectance;
};

float D_GGX(const in float alpha, const in float dotNH) {
    float a2 = alpha * alpha;
    float denom = dotNH * dotNH * (a2 - 1.0) + 1.0;
    return RECIPROCAL_PI * a2 / (denom * denom);
}

float G_GGX_SmithCorrelated(const in float alpha, const in float dotNL, const in float dotNV) {
    float a2 = alpha * alpha;
    float gv = dotNL * sqrt(a2 + (1.0 - a2) * dotNV * dotNV);
    float gl = dotNV * sqrt(a2 + (1.0 - a2) * dotNL * dotNL);
    return 0.5 / max(gv + gl, EPSILON);
}

void redirectStandard(const in StandardMaterial material, const in IncidentLight incidentLight, inout ReflectedLight reflectedLight)
{
    float alpha = material.roughness * material.roughness;
    vec3 viewDir = normalize(-vViewPosition);
    vec3 halfDir = normalize(incidentLight.direction + viewDir);
    vec3 f0 = 0.16 * material.reflectance * material.reflectance * (1.0 - material.metalness) + material.baseColor * material.metalness;
    float dotNL = clamp(dot(material.normal, incidentLight.direction), 0.0, 1.0);
    float dotNV = clamp(dot(material.normal, viewDir), 0.0, 1.0);
    float dotNH = clamp(dot(material.normal, halfDir), 0.0, 1.0);
    float dotLH = clamp(dot(incidentLight.direction, halfDir), 0.0, 1.0);
    vec3 F = F_Schlick(f0, dotLH);
    float G = G_GGX_SmithCorrelated(alpha, dotNL, dotNV);
    float D = D_GGX(alpha, dotNH);
    reflectedLight.directSpecular += F * (G * D) * incidentLight.color * dotNL;

    vec3 diffuseColor = (1.0 - material.metalness) * material.baseColor;
    reflectedLight.directDiffuse += diffuseColor * incidentLight.color * dotNL;
}

vec3 standard(const in StandardMaterial material)
{
    IncidentLight incidentLight;
    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
#if (NUM_DIR_LIGHTS > 0)
    DirectionalLight directionalLight;
    #pragma unroll_loop
    for(int i = 0; i < NUM_DIR_LIGHTS; i ++) {
        directionalLight = directionalLights[i];
        incidentLight.direction = directionalLight.direction;
        incidentLight.color = directionalLight.color;
        redirectStandard(material, incidentLight, reflectedLight);
    }
#endif
    return reflectedLight.directDiffuse + reflectedLight.directSpecular + reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
}
`;
        let variableName = this.name.toLowerCase() + "_" + node.id;
        let statement = `StandardMaterial standardMaterial;
    standardMaterial.baseColor = ${baseColor.variableName};
    standardMaterial.metalness = ${metalness.variableName};
    standardMaterial.normal = ${normal.variableName};
    standardMaterial.roughness = ${roughness.variableName};
    standardMaterial.reflectance = ${reflectance.variableName};
    vec3 ${variableName} = standard(standardMaterial)`;

        material.appendFragmentSourceLine(statement);
        material.fragmentFunctionChunk += functionSource;
        outputs["color"] = {dimension: 3, variableName};
    }
};

export class BlinnPhong extends Rete.Component {
    constructor() {
        super("BlinnPhong");
    }
    builder(node) {
        node.addInput(new Rete.Input("baseColor", "baseColor", anyTypeSocket));
        node.addInput(new Rete.Input("shininess", "shininess", anyTypeSocket));
        node.addInput(new Rete.Input("normal", "normal", anyTypeSocket));
        node.addOutput(new Rete.Output("color", "color", anyTypeSocket));
        return node;
    }
    worker(node, inputs, outputs) {
        let baseColor = inputs["baseColor"][0];
        let normal = inputs["normal"][0];
        let shininess = inputs["shininess"][0];
        if(baseColor === undefined || baseColor.dimension !== 3) {
            return;
        }
        if(normal === undefined || normal.dimension !== 3) {
            return;
        }
        if(shininess === undefined || shininess.dimension !== 1) {
            return;
        }
        let functionSource = `
void redirectBlinnPhong(vec3 normal, vec3 viewDirection,
                        vec3 baseColor, float shininess,
                        const in IncidentLight incidentLight,
                        inout ReflectedLight reflectedLight)
{
    float dotNL = saturate(dot(normal, incidentLight.direction));
    vec3 halfDirection = normalize(incidentLight.direction + viewDirection);
    float dotNH = saturate(dot(normal, halfDirection));
    reflectedLight.directDiffuse += dotNL * incidentLight.color * baseColor;
    reflectedLight.directSpecular += vec3(pow(dotNH, shininess));

}
vec3 blinnPhong(vec3 baseColor, float shininess, vec3 normal)
{
    IncidentLight incidentLight;
    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));;
    vec3 ambientColor = baseColor * ambientLightColor;
#if ( NUM_DIR_LIGHTS > 0 )
    DirectionalLight directionalLight;
    #pragma unroll_loop
    for(int i = 0; i < NUM_DIR_LIGHTS; i ++) {
        directionalLight = directionalLights[i];
        incidentLight.direction = directionalLight.direction;
        incidentLight.color = directionalLight.color;
        redirectBlinnPhong(normal, normalize(-vViewPosition),
                           baseColor, shininess,
                           incidentLight,
                           reflectedLight);
    }
#endif
    return ambientColor + reflectedLight.directDiffuse + reflectedLight.directSpecular;
}
`;
        let variableName = this.name.toLowerCase() + "_" + node.id;
        let statement = `vec3 ${variableName} = blinnPhong(${baseColor.variableName}, ${shininess.variableName}, ${normal.variableName})`;
        let material = this.editor.materialWriter;
        material.enableLight = true;
        material.enablePosition = true;
        material.appendFragmentSourceLine(statement);
        material.fragmentFunctionChunk += functionSource;
        outputs["color"] = {dimension: 3, variableName};
    }
};

class Function extends Rete.Component {
    constructor(source, returnName) {
        
        let sourceCode = source;
        let inputs = [];
        let output;
        let functionName;
        returnName = returnName === undefined ? "return" : returnName;

        let index = source.indexOf(" ");
        let returnType = source.substring(0, index);
        let dimension = typeMap.indexOf(returnType) + 1;
        if(dimension > 0) {
            output = {dimension, variableName: returnName};
        }

        source = source.substring(index + 1);
        index = source.indexOf("(");
        functionName = source.substring(0, index).trim();

        source = source.substring(index + 1);
        index = source.indexOf(")");
        let parametersStr = source.substring(0, index);
        let items = parametersStr.split(",");
        for(let i = 0; i < items.length; ++ i) {
            let item = items[i].trim();
            let subItems = item.split(" ");
            if(subItems.length === 2) {
                let type = subItems[0];
                let variableName = subItems[1];
                dimension = typeMap.indexOf(type) + 1;
                if(dimension > 0) {
                    inputs.push({dimension, variableName});
                }
            }
        }

        super(functionName);
        this.inputs = inputs;
        this.output = output;
        this.source = sourceCode;
    };

    builder(node) {
        for(let i = 0; i < this.inputs.length; ++ i) {
            let input = this.inputs[i];
            node.addInput(new Rete.Input(input.variableName, input.variableName, anyTypeSocket));
        }
        if(this.output !== undefined) {
            node.addOutput(new Rete.Output(this.output.variableName, this.output.variableName, anyTypeSocket));
        }
        return node;
    }

    worker(node, inputs, outputs) {
        for(let i = 0; i < this.inputs.length; ++ i) {
            let expectedInput = this.inputs[i];
            let input = inputs[expectedInput.variableName][0];
            if(input === undefined || input.dimension !== expectedInput.dimension) {
                return;
            }
        }

        let material = this.editor.materialWriter;
        if(!material.externalFunctions.has(this.name)) {
            material.externalFunctions.set(this.name, this.source);
        }
        let variableName = this.name.toLowerCase() + "_" + node.id;
        let statement = `${typeMap[this.output.dimension - 1]} ${variableName} = ${this.name}(`;
        for(let i = 0; i < this.inputs.length; ++ i) {
            let expectedInput = this.inputs[i];
            let input = inputs[expectedInput.variableName][0];
            statement += input.variableName;
            if(i !== this.inputs.length - 1) {
                statement += ",";
            }
        }
        statement += ")";
        material.appendFragmentSourceLine(statement);
        if(this.output !== undefined) {
            outputs[this.output.variableName] = {dimension: this.output.dimension, variableName};
        }
    }

};



export class LinearToneMapping extends Function {
    constructor() {
        let source = `vec3 LinearToneMapping(float exposure, vec3 color) {
    return exposure * color;
}
`;
        super(source, "color");
    }

};

export class ReinhardToneMapping extends Function {
    constructor() {
        let source = `vec3 ReinhardToneMapping(float exposure, vec3 color) {
    color *= exposure;
    return clamp(color / (vec3(1.0) + color), 0.0, 1.0);
}
`;
        super(source, "color");
    }


};

export class Uncharted2ToneMapping extends Function {
    constructor() {
        let source = `vec3 Uncharted2ToneMapping(float exposure, float whitePoint, vec3 color) {
    color *= exposure;
}
`;
        super(source, "color");
    }

};

export class CineonToneMapping extends Function {
    constructor() {
        let source = `vec3 CineonToneMapping(float exposure, vec3 color) {
    color *= exposure;
    color = max(vec3(0.0), color - 0.004);
    return pow((color * (6.2 * color + 0.5)) / (color * (6.2 * color + 1.7) + 0.06 ), vec3(2.2));
}
`;
        super(source, "color");
    }

};

export class ACESFilmicToneMapping extends Function {
    constructor() {
        let source = `vec3 ACESFilmicToneMapping(float exposure, vec3 color) {
    color *= exposure;
    return clamp((color * (2.51 * color + 0.03)) / (color * ( 2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}
`;
        super(source, "color");
    }
};