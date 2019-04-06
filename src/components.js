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


export class PhysicalBased extends Rete.Component {
    constructor() {
        super("PhysicalBased");
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
        let functionSource = `
#define RECIPROCAL_PI 0.31830988618
#define EPSILON 1e-6

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

vec3 F_Schlick(const in vec3 f0, const in float dotLH) {
    float fresnel = exp2((-5.55473 * dotLH - 6.98316) * dotLH);
    return (1.0 - f0) * fresnel + f0;
}

struct PhysicalMaterial
{
    vec3 baseColor;
    float metalness;
    vec3 normal;
    float roughness;
    float reflectance;
};

struct ReflectedLight
{
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
};

struct IncidentLight
{
    vec3 direction;
    vec3 color;
};

void redirectPhysicalBased(const in PhysicalMaterial material, const in IncidentLight incidentLight, inout ReflectedLight reflectedLight)
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

vec3 physicalBased(const in PhysicalMaterial material)
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
        redirectPhysicalBased(material, incidentLight, reflectedLight);
    }
#endif
    return reflectedLight.directDiffuse + reflectedLight.directSpecular + reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
}
`;
        let variableName = this.name.toLowerCase() + "_" + node.id;
        let statement = `PhysicalMaterial physicalMaterial;
    physicalMaterial.baseColor = ${baseColor.variableName};
    physicalMaterial.metalness = ${metalness.variableName};
    physicalMaterial.normal = ${normal.variableName};
    physicalMaterial.roughness = ${roughness.variableName};
    physicalMaterial.reflectance = ${reflectance.variableName};
    vec3 ${variableName} = physicalBased(physicalMaterial)`;

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
void redirectBlinnPhong(vec3 lightDirection, vec3 lightColor,
                        vec3 normal, vec3 viewDirection,
                        vec3 baseColor, float shininess,
                        inout vec3 diffuseColor, inout vec3 specularColor)
{
    float dotNL = saturate(dot(normal, lightDirection));
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float dotNH = saturate(dot(normal, halfDirection));
    diffuseColor += dotNL * lightColor * baseColor;
    specularColor += vec3(pow(dotNH, shininess));

}
vec3 blinnPhong(vec3 baseColor, float shininess, vec3 normal)
{
    vec3 diffuseColor;
    vec3 specularColor;
    vec3 ambientColor = baseColor * ambientLightColor;
#if ( NUM_DIR_LIGHTS > 0 )
    DirectionalLight directionalLight;
    #pragma unroll_loop
    for(int i = 0; i < NUM_DIR_LIGHTS; i ++) {
        directionalLight = directionalLights[i];
        redirectBlinnPhong(directionalLight.direction, directionalLight.color,
                           normal, normalize(-vViewPosition),
                           baseColor, shininess,
                           diffuseColor, specularColor);
    }
#endif
    return ambientColor + diffuseColor + specularColor;
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