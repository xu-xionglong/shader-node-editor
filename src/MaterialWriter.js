export default class MaterialWriter {
	constructor() {
		this.reset();
		this.uniforms = {};
	}

	reset() {
		this.sourceChunk = "";
		this.functionChunk = "";
		this.uniformChunk = "";
		this.varyingChunk = "varying vec2 vUv;\n"
		this.enableNormalMap = false;
	}

	appendSourceLine(source) {
		this.sourceChunk += "\t" + source + ";\n";
	}

	appendUniformLine(uniform) {
		this.uniformChunk += uniform + ";\n";
	}

	generateShader() {
		let fragmentShader = [
			this.uniformChunk,
			this.varyingChunk,
			"void main() {\n",
			this.sourceChunk,
			"}"
		].join("");

		return fragmentShader;
	}
};