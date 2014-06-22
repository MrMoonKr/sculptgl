define([
  'render/shaders/ShaderBackground',
  'render/shaders/ShaderMatcap',
  'render/shaders/ShaderNormal',
  'render/shaders/ShaderPhong',
  'render/shaders/ShaderTransparency',
  'render/shaders/ShaderUV',
  'render/shaders/ShaderWireframe'
], function (Sbackground, Smatcap, Snormal, Sphong, Stransparency, Suv, Swireframe) {

  'use strict';

  function Shader(gl) {
    this.gl_ = gl; // webgl context
    this.type_ = Shader.mode.MATCAP; // type of shader
    this.shader_ = null; // the shader
  }

  Shader.textures = {};
  Shader.mode = {
    PHONG: 0,
    TRANSPARENCY: 1,
    WIREFRAME: 2,
    NORMAL: 3,
    BACKGROUND: 4,
    UV: 5,
    MATCAP: 6
  };

  Shader[Shader.mode.BACKGROUND] = Sbackground;
  Shader[Shader.mode.PHONG] = Sphong;
  Shader[Shader.mode.MATCAP] = Smatcap;
  Shader[Shader.mode.NORMAL] = Snormal;
  Shader[Shader.mode.TRANSPARENCY] = Stransparency;
  Shader[Shader.mode.UV] = Suv;
  Shader[Shader.mode.WIREFRAME] = Swireframe;

  Shader.prototype = {
    /** Initialize the shader */
    init: function () {
      this.shader_ = Shader[this.type_].getOrCreate(this.gl_);
    },
    /** Set the shader */
    setType: function (type) {
      this.type_ = type;
      this.init();
    },
    /** Draw */
    draw: function (render, sculptgl) {
      this.shader_.draw(render, sculptgl);
    }
  };

  return Shader;
});