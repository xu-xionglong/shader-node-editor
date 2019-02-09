export default class MaterialWriter {
	constructor() {
		this.reset();
	}

	reset() {
		this.sourceChunk = "";
		this.functionChunk = "";
		this.uniformChunk = "";
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
			"void main() {\n",
			this.sourceChunk,
			"}"
		].join("");

		return fragmentShader;
	}
};