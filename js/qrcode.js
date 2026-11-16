// Minimal, dependency-free QR Code generator (ISO/IEC 18004, Versions 1-10, Byte mode, EC Level M)
window.MiskiQR = (() => {
  "use strict";

  const EXP_TABLE = new Array(256);
  const LOG_TABLE = new Array(256);
  for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

  function glog(n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return LOG_TABLE[n];
  }
  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP_TABLE[n];
  }

  class Poly {
    constructor(num, shift) {
      let offset = 0;
      while (offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
      for (let i = num.length - offset; i < this.num.length; i++) this.num[i] = 0;
    }
    get(i) { return this.num[i]; }
    getLength() { return this.num.length; }
    multiply(e) {
      const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
        }
      }
      return new Poly(num, 0);
    }
    mod(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = glog(this.get(0)) - glog(e.get(0));
      const num = this.num.slice();
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= gexp(glog(e.get(i)) + ratio);
      }
      return new Poly(num, 0).mod(e);
    }
  }

  function getErrorCorrectPoly(ecLength) {
    let a = new Poly([1], 0);
    for (let i = 0; i < ecLength; i++) {
      a = a.multiply(new Poly([1, gexp(i)], 0));
    }
    return a;
  }

  // EC Level M (0) RS block definitions for versions 1..10
  const RS_BLOCKS_M = {
    1: [[1, 26, 16]],
    2: [[1, 44, 28]],
    3: [[1, 70, 44]],
    4: [[2, 50, 32]],
    5: [[2, 67, 43]],
    6: [[4, 43, 27]],
    7: [[4, 49, 31]],
    8: [[2, 60, 38], [2, 61, 39]],
    9: [[3, 58, 36], [2, 59, 37]],
    10: [[4, 69, 43], [1, 70, 44]],
  };

  const ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
  };

  function getRSBlocks(version) {
    const def = RS_BLOCKS_M[version];
    const list = [];
    for (const [count, totalCount, dataCount] of def) {
      for (let i = 0; i < count; i++) list.push({ totalCount, dataCount });
    }
    return list;
  }

  function getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) { digit++; data >>>= 1; }
    return digit;
  }

  function getBCHTypeInfo(data) {
    const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
    const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
      d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
    }
    return ((data << 10) | d) ^ G15_MASK;
  }

  function getBCHTypeNumber(data) {
    const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
    let d = data << 12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
      d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
    }
    return (data << 12) | d;
  }

  function getMaskBit(maskPattern, i, j) {
    switch (maskPattern) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
      default: return false;
    }
  }

  function buildBitBuffer(bytes, version, rsBlocks) {
    const buffer = [];
    const put = (num, length) => {
      for (let i = 0; i < length; i++) {
        buffer.push(((num >>> (length - i - 1)) & 1) === 1);
      }
    };
    // Byte mode = 4 (0100)
    put(4, 4);
    const lenBits = version < 10 ? 8 : 16;
    put(bytes.length, lenBits);
    for (const b of bytes) put(b, 8);

    const totalDataCount = rsBlocks.reduce((acc, r) => acc + r.dataCount, 0);
    if (buffer.length > totalDataCount * 8) return null;

    if (buffer.length + 4 <= totalDataCount * 8) put(0, 4);
    while (buffer.length % 8 !== 0) buffer.push(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      put(0x11, 8);
    }

    const dataBytes = new Array(totalDataCount).fill(0);
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i]) dataBytes[Math.floor(i / 8)] |= 0x80 >>> (i % 8);
    }
    return dataBytes;
  }

  function createBytes(dataBytes, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);

    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = dataBytes.slice(offset, offset + dcCount);
      offset += dcCount;

      const rsPoly = getErrorCorrectPoly(ecCount);
      const rawPoly = new Poly(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1).fill(0);
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
      }
    }

    const totalCodeCount = rsBlocks.reduce((acc, r) => acc + r.totalCount, 0);
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  }

  function setupMatrix(version, maskPattern, codeBytes) {
    const moduleCount = version * 4 + 17;
    const modules = Array.from({ length: moduleCount }, () => new Array(moduleCount).fill(null));

    const setupPositionProbe = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || moduleCount <= col + c) continue;
          const on =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
          modules[row + r][col + c] = on;
        }
      }
    };

    setupPositionProbe(0, 0);
    setupPositionProbe(moduleCount - 7, 0);
    setupPositionProbe(0, moduleCount - 7);

    // Alignment patterns
    const pos = ALIGN_POS[version] || [];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            modules[row + r][col + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          }
        }
      }
    }

    // Timing patterns
    for (let r = 8; r < moduleCount - 8; r++) {
      if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < moduleCount - 8; c++) {
      if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
    }

    // Format info (EC Level M = 0)
    const bits = getBCHTypeInfo((0 << 3) | maskPattern);
    for (let i = 0; i < 15; i++) {
      const mod = ((bits >> i) & 1) === 1;
      if (i < 6) modules[i][8] = mod;
      else if (i < 8) modules[i + 1][8] = mod;
      else modules[moduleCount - 15 + i][8] = mod;

      if (i < 8) modules[8][moduleCount - i - 1] = mod;
      else if (i < 9) modules[8][15 - i - 1 + 1] = mod;
      else modules[8][15 - i - 1] = mod;
    }
    modules[moduleCount - 8][8] = true;

    // Version info
    if (version >= 7) {
      const vbits = getBCHTypeNumber(version);
      for (let i = 0; i < 18; i++) {
        const mod = ((vbits >> i) & 1) === 1;
        modules[Math.floor(i / 3)][(i % 3) + moduleCount - 8 - 3] = mod;
        modules[(i % 3) + moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    }

    // Map data bits
    let inc = -1;
    let row = moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < codeBytes.length) {
              dark = ((codeBytes[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (getMaskBit(maskPattern, row, col - c)) dark = !dark;
            modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
    return modules;
  }

  function lostPoint(modules) {
    const n = modules.length;
    let lost = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let same = 0;
        const dark = modules[r][c];
        for (let dr = -1; dr <= 1; dr++) {
          if (r + dr < 0 || r + dr >= n) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (c + dc < 0 || c + dc >= n) continue;
            if (dr === 0 && dc === 0) continue;
            if (dark === modules[r + dr][c + dc]) same++;
          }
        }
        if (same > 5) lost += 3 + same - 5;
      }
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        let cnt = 0;
        if (modules[r][c]) cnt++;
        if (modules[r + 1][c]) cnt++;
        if (modules[r][c + 1]) cnt++;
        if (modules[r + 1][c + 1]) cnt++;
        if (cnt === 0 || cnt === 4) lost += 3;
      }
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 6; c++) {
        if (
          modules[r][c] && !modules[r][c + 1] && modules[r][c + 2] &&
          modules[r][c + 3] && modules[r][c + 4] && !modules[r][c + 5] && modules[r][c + 6]
        ) lost += 40;
      }
    }
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n - 6; r++) {
        if (
          modules[r][c] && !modules[r + 1][c] && modules[r + 2][c] &&
          modules[r + 3][c] && modules[r + 4][c] && !modules[r + 5][c] && modules[r + 6][c]
        ) lost += 40;
      }
    }
    let darkCount = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (modules[r][c]) darkCount++;
      }
    }
    const ratio = Math.abs((100 * darkCount) / (n * n) - 50) / 5;
    lost += ratio * 10;
    return lost;
  }

  function generateMatrix(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let chosenVersion = null;
    let rsBlocks = null;
    let dataBytes = null;

    for (let v = 1; v <= 10; v++) {
      const blocks = getRSBlocks(v);
      const buf = buildBitBuffer(bytes, v, blocks);
      if (buf) {
        chosenVersion = v;
        rsBlocks = blocks;
        dataBytes = buf;
        break;
      }
    }
    if (!chosenVersion) throw new Error("URL demasiado larga para código QR");

    const codeBytes = createBytes(dataBytes, rsBlocks);
    let bestMask = 0;
    let bestLost = Infinity;
    let bestModules = null;

    for (let mask = 0; mask < 8; mask++) {
      const mat = setupMatrix(chosenVersion, mask, codeBytes);
      const pts = lostPoint(mat);
      if (pts < bestLost) {
        bestLost = pts;
        bestMask = mask;
        bestModules = mat;
      }
    }
    return bestModules;
  }

  function toSvg(text, { color = "#503629", bg = "#FFFFFF", margin = 3 } = {}) {
    const mat = generateMatrix(text);
    const n = mat.length;
    const size = n + margin * 2;
    let paths = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mat[r][c]) {
          paths += `M${c + margin},${r + margin}h1v1h-1z`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg}"/><path d="${paths}" fill="${color}"/></svg>`;
  }

  return { generateMatrix, toSvg };
})();
