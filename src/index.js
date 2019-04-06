import Rete from 'rete';
import ConnectionPlugin from 'rete-connection-plugin';
import ReactRenderPlugin from "./rete-react-render-plugin";
import * as Components from "./Components"
import ReactDOM from 'react-dom';
import React from 'react';
import Menu from './Menu'
import MaterialWriter from './MaterialWriter'
import * as THREE from 'three';
import OrbitControls from 'three-orbitcontrols'
import TransformControls from './TransformControls'


let _material;
let _camera;
let _scene;
let _renderer;
let _control;
let _lightHelpers = [];



export async function initRete() {
    const container = document.getElementById('rete');
    const editor = new Rete.NodeEditor('ShaderNode@0.0.1', container);
    const engine = await new Rete.Engine('ShaderNode@0.0.1');

    let writer = new MaterialWriter();
    editor.materialWriter = writer;
    let menuCallback = (item) => {
        let promise = item.component.createNode();
        promise.then((node) => {
            editor.addNode(node);
        });
    };

    let menuItems = [
            {name: "Math", subItems: [
            {name: "Add", component: new Components.Add()},
            {name: "Subtract", component: new Components.Subtract()},
            {name: "Multiply", component: new Components.Multiply()},
            {name: "Divide", component: new Components.Divide()},
            {name: "Dot", component: new Components.Dot()},
            {name: "Cross", component: new Components.Cross()},
            {name: "Mix", component: new Components.Mix()}
        ]},
        {name: "Constant", subItems: [
            {name: "ConstantFloat", component: new Components.ConstantFloat()},
            {name: "ConstantVector2", component: new Components.ConstantVector2()},
            {name: "ConstantVector3", component: new Components.ConstantVector3()},
            {name: "ConstantVector4", component: new Components.ConstantVector4()}
        ]},
        {name: "ShadingModel", subItems: [
            {name: "BlinnPhong", component: new Components.BlinnPhong()},
            {name: "Standard", component: new Components.Standard()},
            {name: "Cloth", component: new Components.Cloth()}
        ]},
        {name: "Map", subItems: [
            {name: "Texture", component: new Components.Texture()},
            {name: "NormalMap", component: new Components.NormalMap()},
        ]},
    ];

    let registerComponent = (item) => {
        if(item.subItems !== undefined) {
            item.subItems.forEach(registerComponent);
        }
        else {
            editor.register(item.component);
            engine.register(item.component);
        }
    };
    menuItems.forEach((item) => {
        registerComponent(item);
    });
    let geometryComponent = new Components.Geometry();
    let fragColorComponent = new Components.FragColor();
    editor.register(geometryComponent);
    engine.register(geometryComponent);
    editor.register(fragColorComponent);
    engine.register(fragColorComponent);
    geometryComponent.createNode().then((node) => editor.addNode(node));
    fragColorComponent.createNode().then((node) => editor.addNode(node));

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

    let vertexTextArea = document.getElementById("vertexShader");
    let fragmentTextArea = document.getElementById("fragmentShader")
    vertexTextArea.onchange = () => {
        _material.vertexShader = vertexTextArea.value;
        _material.needsUpdate = true;
    };
    fragmentShader.onchange = () => {
        _material.fragmentShader = fragmentTextArea.value;
        _material.needsUpdate = true;
    }
    editor.on('process nodecreated noderemoved connectioncreated connectionremoved', async () => {
        writer.resetSource();
        await engine.abort();
        await engine.process(editor.toJSON());
        let material = writer.generateMaterial();
        vertexTextArea.value = material.vertexShader;
        fragmentTextArea.value = material.fragmentShader;
        _material.vertexShader = material.vertexShader
        _material.fragmentShader = material.fragmentShader;
        _material.uniforms = material.uniforms;
        _material.lights = writer.enableLight;
        _material.extensions.derivatives = writer.enableNormalMap;
        _material.needsUpdate = true;
        _material.uniformsNeedUpdate = true;
    });
}

function init() {
    let container = document.getElementById("viewport");
    let width = container.offsetWidth;
    let height = container.offsetHeight
    _renderer = new THREE.WebGLRenderer({antialias:true});
    _renderer.setPixelRatio(window.devicePixelRatio);
    _renderer.setSize(width, height);
    container.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    _scene.add(new THREE.AmbientLight());
    _scene.background = new THREE.Color(0xf0f0f0);
    _camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
    _camera.position.z = 15;

    _control = new OrbitControls(_camera, container);
    _control.enableKeys = false

    let geometry = new THREE.SphereGeometry(5, 30, 30);
    _material = new THREE.ShaderMaterial();
    let sphere = new THREE.Mesh(geometry, _material);
    _scene.add(sphere);

    let lightDirs = [
        new THREE.Vector3(15, 0, 0),
        new THREE.Vector3(0, 15, 0),
        new THREE.Vector3(-15, 0, 0)
    ];
    lightDirs.forEach((dir) => {
        let light = new THREE.DirectionalLight();
        light.position.copy(dir);
        _scene.add(light);
        let helper = new THREE.DirectionalLightHelper(light, 2.0);
        _scene.add(helper);
        let control = new THREE.TransformControls(_camera, container);
        control.attach(light);
        _scene.add(control);
        control.addEventListener('dragging-changed', function(event) {
            _control.enabled = !event.value;
        });
        _lightHelpers.push(helper)
    });


    update();
}

function update()
{
    for(let i = 0; i < _lightHelpers.length; ++ i) {
        _lightHelpers[i].update();
    }
    requestAnimationFrame(update);
    _control.update();
    _renderer.render(_scene, _camera);
}

init();
initRete();
