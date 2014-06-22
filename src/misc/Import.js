define([
  'misc/Utils'
], function (Utils) {

  'use strict';

  var Import = {};

  /** Import OBJ file */
  Import.importOBJ = function (data, mesh) {
    var vAr = [];
    var texAr = [];
    var fAr = [];
    var uvfAr = [];
    var nbVertices = 0;
    var nbTexCoords = 0;
    var lines = data.split('\n');
    var split = [];
    var nbLength = lines.length;
    for (var i = 0; i < nbLength; ++i) {
      var line = lines[i].trim();
      if (line.startsWith('v ')) {
        split = line.split(/\s+/);
        vAr.push(parseFloat(split[1]), parseFloat(split[2]), parseFloat(split[3]));
        ++nbVertices;
      } else if (line.startsWith('vt ')) {
        split = line.split(/\s+/);
        texAr.push(parseFloat(split[1]), parseFloat(split[2]));
        ++nbTexCoords;
      } else if (line.startsWith('f ')) {
        split = line.split(/\s+/);
        var sp1 = split[1].split('/');
        var sp2 = split[2].split('/');
        var sp3 = split[3].split('/');
        var isQuad = split.length > 4;

        var iv1 = parseInt(sp1[0], 10);
        var iv2 = parseInt(sp2[0], 10);
        var iv3 = parseInt(sp3[0], 10);
        var iv4 = isQuad ? parseInt(split[4].split('/')[0], 10) : undefined;
        if (isQuad && (iv4 === iv1 || iv4 === iv2 || iv4 === iv3))
          continue;
        if (iv1 === iv2 || iv1 === iv3 || iv2 === iv3)
          continue;
        iv1 = iv1 < 0 ? iv1 + nbVertices : iv1 - 1;
        iv2 = iv2 < 0 ? iv2 + nbVertices : iv2 - 1;
        iv3 = iv3 < 0 ? iv3 + nbVertices : iv3 - 1;
        if (isQuad) iv4 = iv4 < 0 ? iv4 + nbVertices : iv4 - 1;
        fAr.push(iv1, iv2, iv3, isQuad ? iv4 : -1);

        if (sp1[1]) {
          var uv1 = parseInt(sp1[1], 10);
          var uv2 = parseInt(sp2[1], 10);
          var uv3 = parseInt(sp3[1], 10);
          var uv4 = isQuad ? parseInt(split[4].split('/')[1], 10) : undefined;
          uv1 = uv1 < 0 ? uv1 + nbTexCoords : uv1 - 1;
          uv2 = uv2 < 0 ? uv2 + nbTexCoords : uv2 - 1;
          uv3 = uv3 < 0 ? uv3 + nbTexCoords : uv3 - 1;
          if (isQuad) uv4 = uv4 < 0 ? uv4 + nbTexCoords : uv4 - 1;
          uvfAr.push(uv1, uv2, uv3, isQuad ? uv4 : -1);
        }
      }
    }
    mesh.setVertices(new Float32Array(vAr));
    mesh.setFaces(new Int32Array(fAr));
    if (texAr.length > 0)
      mesh.initTexCoordsDataFromOBJData(texAr, uvfAr);
  };

  /** Import PLY file */
  Import.importPLY = function (buffer, mesh) {
    var data = Utils.ab2str(buffer);
    var vAr, cAr, fAr;
    var lines = data.split('\n');
    var split = [];
    var nbVertices = -1;
    var nbFaces = -1;
    var colorIndex = -1;
    var i = 0;
    var isBinary = false;
    var offsetData = 0;
    var offsetVertex = 0;
    while (true) {
      var line = lines[i];
      offsetData += line.length;
      line = line.trim();
      if (line.startsWith('format binary')) {
        isBinary = true;
      } else if (line.startsWith('element vertex ')) {
        split = line.split(/\s+/);
        nbVertices = parseInt(split[2], 10);
        var startIndex = i;
        while (true) {
          ++i;
          var raw = lines[i];
          line = raw.trim();
          if (line.startsWith('property ')) {
            split = line.split(/\s+/)[2];
            if (split === 'red') {
              colorIndex = i - startIndex - 1;
            } else if (split === 'alpha') {
              offsetVertex += 1;
            } else if (split === 'material_index') {
              offsetVertex += 4;
            }
          } else
            break;
          offsetData += raw.length;
        }
        --i;
      } else if (line.startsWith('element face ')) {
        split = line.split(/\s+/);
        nbFaces = parseInt(split[2], 10);
      } else if (line.startsWith('end_header')) {
        ++i;
        vAr = new Float32Array(nbVertices * 3);
        cAr = colorIndex !== -1 ? new Float32Array(nbVertices * 3) : null;
        fAr = new Int32Array(nbFaces * 4);
        var offsetFace = 0;
        if (isBinary)
          offsetFace = Import.importBinaryPLY(buffer, offsetData + i, offsetVertex, vAr, fAr, cAr, colorIndex);
        else
          offsetFace = Import.importAsciiPLY(lines, i, vAr, fAr, cAr, colorIndex);
        fAr = fAr.subarray(0, offsetFace);
        break;
      }
      ++i;
    }
    mesh.setVertices(vAr);
    mesh.setFaces(fAr);
    mesh.setColors(cAr);
  };

  /** Import binary PLY file */
  Import.importBinaryPLY = function (buffer, offData, offVert, vAr, fAr, cAr, colorIndex) {
    var data = new Uint8Array(buffer);
    var nbVertices = vAr.length / 3;
    var vb = new Uint8Array(nbVertices * 12);
    var i = 0;
    var inc = 0;
    var idv = 0;
    var idc = 0;
    var inv255 = 1.0 / 255.0;
    for (i = 0; i < nbVertices; ++i) {
      for (inc = 0; inc < 12; ++inc) {
        vb[idv++] = data[offData++];
      }
      if (cAr) {
        offData += (colorIndex - 3) * 4; // if offset normal
        cAr[idc++] = data[offData++] * inv255;
        cAr[idc++] = data[offData++] * inv255;
        cAr[idc++] = data[offData++] * inv255;
      }
      offData += offVert;
    }
    vAr.set(new Float32Array(vb.buffer));

    var nbFaces = fAr.length / 4;
    var ib = new Int8Array(nbFaces * 16);
    var idt = 0;
    for (i = 0; i < nbFaces; ++i) {
      var pol = data[offData++];
      var nb = pol * 4;
      if (pol === 3 || pol === 4) {
        for (inc = 0; inc < nb; ++inc) {
          ib[idt++] = data[offData++];
        }
        if (pol === 3) {
          ib[idt++] = -1;
          ib[idt++] = -1;
          ib[idt++] = -1;
          ib[idt++] = -1;
        }
      }
    }
    fAr.set(new Int32Array(ib.buffer));
    return idt / 4;
  };

  /** Import Ascii PLY file */
  Import.importAsciiPLY = function (lines, i, vAr, iAr, cAr, colorIndex) {
    var split;
    var nbVertices = vAr.length / 3;
    var endVertices = nbVertices + i;
    var inv255 = 1.0 / 255.0;

    var id = 0;
    for (; i < endVertices; ++i) {
      split = lines[i].trim().split(/\s+/);
      vAr[id] = parseFloat(split[0]);
      vAr[id + 1] = parseFloat(split[1]);
      vAr[id + 2] = parseFloat(split[2]);
      if (cAr) {
        cAr[id] = parseInt(split[colorIndex], 10) * inv255;
        cAr[id + 1] = parseInt(split[colorIndex + 1], 10) * inv255;
        cAr[id + 2] = parseInt(split[colorIndex + 2], 10) * inv255;
      }
      id += 3;
    }
    var nbFaces = iAr.length / 4;
    var endFaces = nbFaces + i;
    id = 0;
    for (; i < endFaces; ++i) {
      split = lines[i].trim().split(/\s+/);
      var nbVert = parseInt(split[0], 10);
      if (nbVert === 3 || nbVert === 4) {
        iAr[id] = parseInt(split[1], 10);
        iAr[id + 1] = parseInt(split[2], 10);
        iAr[id + 2] = parseInt(split[3], 10);
        iAr[id + 3] = nbVert === 4 ? parseInt(split[4], 10) : -1;
        id += 4;
      }
    }
    return id;
  };

  /** Import STL file */
  Import.importSTL = function (buffer, mesh) {
    var nbTriangles = new Uint32Array(buffer, 80, 1)[0] || 0;
    var isBinary = 84 + (nbTriangles * 50) === buffer.byteLength;
    var vb = isBinary ? Import.importBinarySTL(buffer, nbTriangles) : Import.importAsciiSTL(Utils.ab2str(buffer));
    nbTriangles = vb.length / 9;
    var mapVertices = {};
    var nbVertices = [0];
    var iAr = new Int32Array(nbTriangles * 4);
    for (var i = 0; i < nbTriangles; ++i) {
      var idt = i * 4;
      var idv = i * 9;
      iAr[idt] = Import.detectNewVertex(mapVertices, vb, idv, nbVertices);
      iAr[idt + 1] = Import.detectNewVertex(mapVertices, vb, idv + 3, nbVertices);
      iAr[idt + 2] = Import.detectNewVertex(mapVertices, vb, idv + 6, nbVertices);
      iAr[idt + 3] = -1;
    }
    mesh.setVertices(vb.subarray(0, nbVertices[0] * 3));
    mesh.setFaces(iAr);
  };

  /** Check if the vertex already exists */
  Import.detectNewVertex = function (mapVertices, vb, start, nbVertices) {
    var x = vb[start];
    var y = vb[start + 1];
    var z = vb[start + 2];
    var hash = x + '+' + y + '+' + z;
    var idVertex = mapVertices[hash];
    if (idVertex === undefined) {
      mapVertices[hash] = idVertex = nbVertices[0];
      var id = idVertex * 3;
      vb[id] = x;
      vb[id + 1] = y;
      vb[id + 2] = z;
      nbVertices[0]++;
    }
    return idVertex;
  };

  /** Import Ascii STL file */
  Import.importAsciiSTL = function (data) {
    var lines = data.split('\n');
    var nbLength = lines.length;
    var vb = new Float32Array(Math.ceil(nbLength * 9 / 7));
    var acc = 0;
    for (var i = 0; i < nbLength; ++i) {
      var line = lines[i].trim();
      if (line.startsWith('facet')) {
        var split = lines[i + 2].trim().split(/\s+/);
        vb[acc++] = parseFloat(split[1]);
        vb[acc++] = parseFloat(split[2]);
        vb[acc++] = parseFloat(split[3]);
        split = lines[i + 3].trim().split(/\s+/);
        vb[acc++] = parseFloat(split[1]);
        vb[acc++] = parseFloat(split[2]);
        vb[acc++] = parseFloat(split[3]);
        split = lines[i + 4].trim().split(/\s+/);
        vb[acc++] = parseFloat(split[1]);
        vb[acc++] = parseFloat(split[2]);
        vb[acc++] = parseFloat(split[3]);
      }
    }
    return vb.subarray(0, acc);
  };

  /** Import binary STL file */
  Import.importBinarySTL = function (buffer, nbTriangles) {
    var data = new Uint8Array(buffer);
    var i = 0;
    var vb = new Uint8Array(nbTriangles * 36);
    var offset = 96;
    var j = 0;
    for (i = 0; i < nbTriangles; i++) {
      for (var inc = 0; inc < 36; ++inc) {
        vb[j++] = data[offset++];
      }
      offset += 14;
    }
    return new Float32Array(vb.buffer);
  };

  return Import;
});