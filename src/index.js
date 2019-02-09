import Rete from 'rete';
import ConnectionPlugin from 'rete-connection-plugin';
import ReactRenderPlugin from "./rete-react-render-plugin";
import {
    Add,
    Subtract,
    Multiply,
    Divide,
    Geometry,
    FragColor,
    ConstantFloat,
    ConstantVector2,
    ConstantVector3,
    ConstantVector4,
    Dot,
    Cross,
    Mix,
    Texture,
} from "./Components"
import ReactDOM from 'react-dom';
import React from 'react';
import Menu from './Menu'
import MaterialWriter from './MaterialWriter'


export async function initRete() {
    const container = document.querySelector('#rete');
    const editor = new Rete.NodeEditor('ShaderNode@0.0.1', container);
    const engine = await new Rete.Engine('ShaderNode@0.0.1');

    let writer = new MaterialWriter();
    let menuCallback = (item) => {
        let promise = item.component.createNode();
        promise.then((node) => {
            editor.addNode(node);
            node.material = writer;
        });
    };
    let menuItems = [
        {name: "Add", component: new Add()},
        {name: "Subtract", component: new Subtract()},
        {name: "Multiply", component: new Multiply()},
        {name: "Divide", component: new Divide()},
        {name: "Dot", component: new Dot()},
        {name: "Cross", component: new Cross()},
        {name: "Mix", component: new Mix()},
        {name: "Geometry", component: new Geometry()},
        {name: "FragColor", component: new FragColor()},
        {name: "ConstantFloat", component: new ConstantFloat()},
        {name: "ConstantVector2", component: new ConstantVector2()},
        {name: "ConstantVector3", component: new ConstantVector3()},
        {name: "ConstantVector4", component: new ConstantVector4()},
        {name: "Texture", component: new Texture()}
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
        writer.reset();
        await engine.abort();
        await engine.process(editor.toJSON());
        console.log(writer.generateShader());
    });
}

function init() {

}

initRete();