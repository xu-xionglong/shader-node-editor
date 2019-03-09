import React from 'react';
import ReactDOM from 'react-dom';
import './menu.css'


export default class Menu extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			show: false,
			x: 100,
			y: 100
		};
	}

	renderItem(item) {
		if(item.subItems !== undefined) {
			let subMenu = this.renderMenu(item.subItems, false);
			return (
				<div className="item">
					{item.name}
					{subMenu}
				</div>
			);
		}

		return (
			<div onClick={() => {this.props.callback(item); this.hide();}} className="item">
				{item.name}
			</div>
		);
	}

	renderMenu(items, isRoot) {
		let menuItems = items.map((item) => {
			return this.renderItem(item);
		});


		if(isRoot) {
			let style = {
				display: this.state.show ? "block" : "none",
				position: "fixed",
				left: this.state.x,
				top: this.state.y
			};
			return (
				<div style={style}>
					{menuItems}
				</div>
			);
		}
		else {
			return (
				<div className="menu">
					{menuItems}
				</div>
			);
		}

	}


	render() {
		return this.renderMenu(this.props.items, true);
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