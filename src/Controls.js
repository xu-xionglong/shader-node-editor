import Rete from 'rete';
import React from 'react';
import ReactDOM from 'react-dom';
import dog from './dog.jpg'
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
		let imageStyle = {
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
			reader.readAsDataURL(file);
			reader.onload = (e) => {
				this.imageElement.src = e.target.result;
			};

		};

		let onImageRef = (el) => {
			this.imageElement = el;
			let texture = new THREE.Texture(this.imageElement);
        	this.emitter.materialWriter.uniforms[this.key] = {value: texture};
        	this.imageElement.onload = () => {
            	texture.needsUpdate = true;
        	};
		}
		this.template = (
			<div style={divStyle}>
				<input type="file" style={inputStyle} ref={(el) => {this.inputElement = el;}} onChange={onChange}/>
				<img src={dog} alt="" style={imageStyle} onClick={onClick} ref={onImageRef}/>
			</div>
		);
	}
};

