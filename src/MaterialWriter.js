import * as THREE from 'three';
export default class MaterialWriter {
	constructor() {
		this.resetSource();
		this.uniforms = {};
	}

	resetSource() {
		this.fragmentSourceChunk = "";
		this.fragmentFunctionChunk = "";
		this.fragmentUniformChunk = "";

		this.enableNormal = false;
		this.enableUV = false;
		this.enablePosition = false;
		this.enableNormalMap = false;
		this.enableLight = false;
		this.enableFresnel = false;
	}

	appendFragmentSourceLine(source) {
		this.fragmentSourceChunk += "\t" + source + ";\n";
	}

	appendFragmentUniformLine(uniform) {
		this.fragmentUniformChunk += uniform + ";\n";
	}

	generateMaterial() {
		let varyingChunk = "";
		if(this.enableUV) varyingChunk += "varying vec2 vUv;\n";
		if(this.enableNormal) varyingChunk += "varying vec3 vNormal;\n";
		if(this.enablePosition) varyingChunk += "varying vec3 vViewPosition;\n"

		let vertexShader = [
			varyingChunk,
			"void main() {\n",
			this.enableUV ? "\tvUv = uv;\n" : "",
			this.enableNormal ? "\tvNormal = normalize(normalMatrix * normal);\n" : "",
			"\tvec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\n",
			this.enablePosition ? "\tvViewPosition = mvPosition.xyz;\n" : "",
			"\tgl_Position = projectionMatrix * mvPosition;\n",
			"}"
		].join("");

		let uniforms = this.uniforms;
		let fragmentBuiltinChunk = "";
		if(this.enableLight) {
			fragmentBuiltinChunk += `uniform vec3 ambientLightColor;
#if NUM_DIR_LIGHTS > 0
struct DirectionalLight {
	vec3 direction;
	vec3 color;

	int shadow;
	float shadowBias;
	float shadowRadius;
	vec2 shadowMapSize;
};
uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];
#endif

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
`;
			uniforms = Object.assign(uniforms, THREE.UniformsUtils.clone(THREE.UniformsLib.lights));
		}
		if(this.enableNormalMap) {
			fragmentBuiltinChunk += `
vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 frag_norm, float normalScale) {
	vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
	vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
	vec2 st0 = dFdx( vUv.st );
	vec2 st1 = dFdy( vUv.st );
	float scale = sign( st1.t * st0.s - st0.t * st1.s );
	vec3 S = normalize( ( q0 * st1.t - q1 * st0.t ) * scale );
	vec3 T = normalize( ( - q0 * st1.s + q1 * st0.s ) * scale );
	vec3 N = normalize( surf_norm );
	mat3 tsn = mat3( S, T, N );
	vec3 mapN = frag_norm * 2.0 - 1.0;
	mapN.xy *= normalScale;
	mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );
	return normalize( tsn * mapN );
}
`;
		}
		if(this.enableFresnel) {
			fragmentBuiltinChunk += `
vec3 F_Schlick(const in vec3 f0, const in float dotLH) {
    float fresnel = exp2((-5.55473 * dotLH - 6.98316) * dotLH);
    return (1.0 - f0) * fresnel + f0;
}
`
		}
		let fragmentShader = [
			"#define RECIPROCAL_PI 0.31830988618\n",
			"#define EPSILON 1e-6\n",
			this.fragmentUniformChunk,
			varyingChunk,
			fragmentBuiltinChunk,
			this.fragmentFunctionChunk,
			"void main() {\n",
			this.enableNormal ? "\tvec3 normal = normalize(vNormal);\n" : "",
			this.fragmentSourceChunk,
			"}"
		].join("");

		return {vertexShader, fragmentShader, uniforms};
	}
};