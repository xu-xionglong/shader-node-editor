import Rete from 'rete';
import React from 'react';
import ReactDOM from 'react-dom';

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
		this.template = (
			<div>
				<input type="file" />
			</div>
			
		);
	}
};

