import Rete from 'rete';
import React from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';

export class TextInputControl extends Rete.Control {
	constructor(key, emitter, formatChecker) {
		super(key);
		this.template = (
			<input onChange={(e) => {
				let value = e.target.value;
				if(formatChecker(value)) {
					this.putData(this.key, value);
					emitter.trigger("process");
				}
			}}/>
		);
	}

};

export class ImageSelectControl extends Rete.Control {
	constructor(key, emitter) {
		super(key);
		this.emitter = emitter;
		let divStyle = {
			width: "140px",
			height: "140px",
		};
		let inputStyle = {
			display: "none"
		};
		let canvasStyle = {
			width: "140px",
			height: "140px"
		};
		let onClick = (e) => {
			if(this.inputElement !== undefined) {
				this.inputElement.click();
			}
		};
		let onChange = (e) => {
			let reader = new FileReader();
			let file = this.inputElement.files[0];
			reader.onload = (e) => {
				let image = document.createElement("img");
				image.addEventListener("load", (e) => {
					let texture = new THREE.Texture(image);
					this.emitter.materialWriter.uniforms[this.key] = {value: texture};
					texture.needsUpdate = true;

					let context = this.canvasElement.getContext("2d");
					context.drawImage(image, 0, 0);
				}, false);
				image.src = e.target.result;
			};
			reader.readAsDataURL(file);
		};

		let onCanvasRef = (el) => {
			let context = el.getContext("2d");
			context.fillStyle = "black";
			context.fillRect(0, 0, el.width, el.height);
			this.canvasElement = el;
		}
		this.template = (
			<div style={divStyle}>
				<input type="file" style={inputStyle} ref={(el) => {this.inputElement = el;}} onChange={onChange}/>
				<canvas style={canvasStyle} onClick={onClick} ref={onCanvasRef}/>
			</div>
		);
	}
};

