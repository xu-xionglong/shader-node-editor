import React from 'react';
import ReactDOM from 'react-dom';


export default class Menu extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			show: false,
			x: 100,
			y: 100
		};
	}

	render() {
		let items = this.props.items.map((item) => {
			return (
				<div onClick={() => { this.props.callback(item); this.hide(); }}>
					{item.name}
				</div>
			);
		});
		let style = {
			display: this.state.show ? "block" : "none",
			position: "fixed",
			left: this.state.x,
			top: this.state.y
		};
		return (
			<div style={style}>
				{items}
			</div>
		);
	}

	show() {
		this.setState({show: true});
	}

	hide() {
		this.setState({show: false});
	}

	setPosition(x, y) {
		this.setState({x, y});
	}
};