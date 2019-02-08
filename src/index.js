import Rete from 'rete';
import ConnectionPlugin from 'rete-connection-plugin';
import ReactRenderPlugin from "./rete-react-render-plugin";
import {
    Add,
    Subtract
} from "./components"
import ReactDOM from 'react-dom';
import React from 'react';
import Menu from './menu'


export async function initRete() {
    const container = document.querySelector('#rete');
    const editor = new Rete.NodeEditor('ShaderNode@0.0.1', container);
    const engine = await new Rete.Engine('ShaderNode@0.0.1');

    let menuCallback = (item) => {
        console.log(item.name);
        let promise = item.component.createNode();
        promise.then((node) => {
            editor.addNode(node);
        });
    };
    let menuItems = [
        {name: "Add", component: new Add()},
        {name: "Subtract", component: new Subtract()},
    ];
    menuItems.forEach((item) => {
        editor.register(item.component);
        engine.register(item.component);
    });
    let el = document.createElement("div");
    editor.view.container.appendChild(el);
    let menu = ReactDOM.render(<Menu items={menuItems} callback={menuCallback}/>, el);
    editor.on("contextmenu", ({ e, node }) => {
        e.preventDefault();
        e.stopPropagation();
        const [x, y] = [e.clientX, e.clientY];
        menu.setState({show: true, x, y});
    });
    editor.on("click", () => {
        menu.hide();
    });

    editor.use(ConnectionPlugin)
    editor.use(ReactRenderPlugin) 
    editor.on('process nodecreated noderemoved connectioncreated connectionremoved', async () => {
        await engine.abort();
        await engine.process(editor.toJSON());
    });
}

initRete();