const keys = [1,2,4,8];
const maxC = 15;

const round = [...Array(maxC)].map((_,i) => 2 ** (keys.findLastIndex(j => j < i+1)) * 8);
const maxP = round.slice(-1)[0];

const svgns = 'http://www.w3.org/2000/svg';

const chooseFrom = a => a[Math.random() * a.length | 0];

const polarToCartesian = (r, f) => [
  r * 20 * Math.cos(f * 2 * Math.PI),
  r * 20 * Math.sin(f * 2 * Math.PI)
];

class Button {
  constructor (el, callback) {
    this.el = el;
    el.addEventListener('click', () => callback(this.to));
    el.addEventListener('touch', () => callback(this.to));
    
    this.hide();
  }
  
  show (neighbour, closed) {
    this.el.style.display = null;
    this.el.disabled = closed;
    this.to = neighbour;
  }
  
  hide () {
    this.el.style.display ='none';
    this.to = null;
  }
}

class Director {
  constructor () {
    this.direct = document.getElementById('direct');
    this.ball = document.getElementById('ball');

    this.move = {};
    this.direct.querySelectorAll('button').forEach(el => {
      const btn = new Button(el, this.setTo.bind(this));
      this.move[el.id] = btn;
    });
  }
  
  setTo (cell) {
    const {r, f} = cell.polarCoordinates;
    const [x, y] = polarToCartesian(r, f);

    this.ball.style.transform = `translate(${x}px, ${y}px)`;
    this.direct.style.transform = `rotate(${f * 360 + 90}deg)`;
    
    for (const btn of Object.values(this.move)) {
      btn.hide();
    }
    
    if(!cell.c) {
      body.classList.add('solved');
      return;
    }

    for (const [n, dir] of this.cells.neighbours(cell)) {
      const [cat, w, r] = cell.getWall(n);
      
      this.move['btn' + dir].show(n, this.walls.get(cat, w).isOpen(r));
    }
  }
}

class Cell {
  #doubles = keys.slice(1);
  #halfes = this.#doubles.map(j => j - 1);

  constructor (c, p) {
    this.c = c;
    this.p = p;
    this.maze = false;

    const r = round[this.c];
    
    this.neighbours = [];
    
    if (this.c < maxC - 1) {
      this.neighbours.push([this.c, (this.p - 1 + r) % r, 'Left']);
      this.neighbours.push([this.c, (this.p + 1) % r, 'Right']);
    }
    
    if (this.insideLess) {
      this.neighbours.push([this.c - 1, this.p >> 1, 'Down']);
    } else if (this.c > 1) {
      this.neighbours.push([this.c - 1, this.p, 'Down']);
    } else if (this.c == 1) {
      this.neighbours.push([0, 0, 'Down']);
    }
    
    if (this.outsideMore) {
      this.neighbours.push([this.c + 1, this.p * 2, 'Up1']);
      this.neighbours.push([this.c + 1, this.p * 2 + 1, 'Up2']);
    } else if (this.c < maxC - 2) {
      this.neighbours.push([this.c + 1, this.p, 'Up1']);
    }
  }
  
  get polarCoordinates () {
    return {
      r: this.c ? this.c + 1.5 : 0,
      f: (this.p * 2 + 1) / round[this.c] / 2
    }
  }
  
  get outsideMore () {
    return this.#halfes.includes(this.c);
  }
  
  get insideLess () {
    return this.#doubles.includes(this.c);
  }

  after (cell) {
    return (this.p || round[this.c]) - cell?.p == 1;
  }
  
  getWall (cell) {
    if (cell.c < this.c) {
      return ['c', this.c + 1, this.p];
    } else if (cell.c > this.c) {
      return ['c', cell.c + 1, cell.p];
    } else {
      const higher = this.after(cell) ? this : cell;
      const ray = higher.p * maxP / round[higher.c];
  
      return ['p', ray, this.c];
    }
  }
}

class Cells {
  #o = [[new Cell(0, 0)]];

  constructor () {    
    for (let c = 1; c < maxC - 1; c++) {    
      this.#o[c] = [];

      for (let p = 0; p < round[c]; p++) {
        this.#o[c][p] = new Cell(c, p);
      }
    }
  }
  
  get (c, p) {
    return this.#o[c]?.[p];
  }
  
  neighbours (cell) {
    return cell.neighbours.map(([c, p, d]) => [this.get(c, p), d]);
  }
  
  fieldNeighbours (cell) {
    return cell.neighbours?.map(([c, p]) => this.get(c, p)).filter(n => n.c);
  }
  
  get all () {
    return this.#o.slice(1).flat();
  }
}

class Wall {
  constructor (primitive, length) {
    this.primitive = document.createElementNS(svgns, primitive);
    this.primitive.setAttribute('pathLength', length);

    this.sectors = Array(length).fill(true);
    
    root.appendChild(this.primitive);
  }
  
  sectorsToDashes () {
    let array = [0],
        last = false;

    for (let s of this.sectors) {
      if (s === last) {
        array[array.length - 1]++;
      } else {
        array.push(1);
      }

      last = s;
    }

    const offset = array.shift();
    array.push(offset);
    
    this.primitive.style.strokeDasharray = array.join(' ');
    this.primitive.style.strokeDashoffset = -offset;
  }
  
  async remove (sector) {
    this.sectors[sector - this.base] = false;
    
    await new Promise((resolve) => requestAnimationFrame(() => {
      this.sectorsToDashes();
      
      resolve();
    }));
    
  }
  
  isOpen (sector) {
    return this.sectors[sector - this.base];
  }
}

class CircularWall extends Wall {
  constructor (radius) {
    const sectors = round[radius - 1];
    
    super('circle', sectors);
    this.base = 0;

    if (radius == 2) this.primitive.setAttribute('id', 'center');
    this.primitive.setAttribute('r', radius * 20);
  }
}

class PerpendicularWall extends Wall {
  constructor (ray) {
    const min = round.findIndex((r, i) => i && !(ray % (maxP / r))) + 1

    super('line', maxC - min);
    this.base = min - 1;

    const [x1, y1] = polarToCartesian(min, ray / maxP);
    this.primitive.setAttribute('x1', x1);
    this.primitive.setAttribute('y1', y1);

    const [x2, y2] = polarToCartesian(maxC, ray / maxP);
    this.primitive.setAttribute('x2', x2);
    this.primitive.setAttribute('y2', y2);
  }
}

class Walls {
  #c = [];
  #p = [];

  constructor () {
    for (let r = 2; r < maxC + 1; r++) {
      this.#c[r] = new CircularWall(r);
    }

    for (let r = 0; r < maxP; r++) {
      this.#p[r] = new PerpendicularWall(r);
    }
  }

  get (cat, w) {
    return cat == 'c' ? this.#c[w] : this.#p[w];
  }
}

const walks = {
  wilsons: async function (cells, walls) {
    let available = cells.all.filter(cell => !cell.maze);

    do {
      let current = chooseFrom(available);

      const walk = [current];

      while (!current.maze) {
        const loop = walk.indexOf(current);
        if (loop >= 0) {
          walk.splice(loop + 1);
        }

        current = chooseFrom(cells.fieldNeighbours(current));

        walk.push(current);
      }

      for(let [i, c] of walk.entries()) {
        if (c.maze) break;
        
        const [cat, w, r] = c.getWall(walk[i + 1]);
        
        await walls.get(cat, w).remove(r);

        c.maze = walk[i + 1];
      }

      available = available.filter(cell => !cell.maze);
    } while (available.length);
  },
  
  prims: async function (cells, walls, from) {
    const eligable = new Set(cells.fieldNeighbours(from));
    
    while (eligable.size) {
      const step = chooseFrom([...eligable]);
      const from = chooseFrom(cells.fieldNeighbours(step).filter(n => n.maze));

      const [cat, w, r] = from.getWall(step);
      
      await walls.get(cat, w).remove(r);
      
      step.maze = from;

      eligable.delete(step);
      cells.fieldNeighbours(step).forEach(n => {
        if (!n.maze) eligable.add(n);
      });
    }
  },
  
  depthFirst: async function (cells, walls, from) {
    do {
      const step = chooseFrom(cells.fieldNeighbours(from).filter(n => !n.maze));

      const [cat, w, r] = from.getWall(step);
      
      await walls.get(cat, w).remove(r);
      
      step.maze = from;
      from = step;

      while (cells.fieldNeighbours(from)?.every(n => n.maze)) {
        from = from.maze;
      }
    } while (typeof from.maze == 'object');
  }
}

function stepBackwards (step) {
  const steps = [step];
  
  while(typeof step.maze == 'object') {
    step = step.maze;
    steps.push(step);
  }
  
  return steps;
}

function solve (cells, start, end) {
  const s1 = stepBackwards(cells.get(maxC - 2, start));
  const s2 = stepBackwards(cells.get(1, end));
  const startCell = new Cell(maxC - 1, start);

  while (s1.slice(-2)[0] === s2.slice(-2)[0]) {
    s1.splice(-1);
    s2.splice(-1);
  }
  s1.splice(-1);
  
  const solution = s1.concat(s2.reverse());
  solution.unshift(startCell);

  const polar = solution.map((cell, i) => ({
    ...cell.polarCoordinates,
    o: cell.outsideMore,
    s: cell.after(solution[i + 1]) ? 0 : 1
  }));
  
  const d = ['M'];

  polar.forEach(({r, f, o, s}, i) => {
    const prev = polar[i - 1];
    const next = polar[i + 1];

    if (prev && r < prev.r && o) {
      f = prev.f;
    }
    if (next && r < next.r && o) {
      if (prev && r < prev.r) {
        d.push(...polarToCartesian(r, f));
      }
      f = next.f;
    }

    d.push(...polarToCartesian(r, f));
    
    if (next && r == next.r) {
      d.push('A', r * 20, r * 20, 0, 0, s);
    } else {
      d.push('L')
    }
  });
  
  d.push(0, 0);
  
  const path = document.createElementNS(svgns, 'path');
  path.setAttribute('d', d.join(' '));
  root.appendChild(path);
  
  return startCell;
}

async function init(algorithm) {
  const size = maxC * 20 + 50;
  document.querySelector('svg').setAttribute('viewBox', [-size, -size, 2*size, 2*size].join(' '));

  root.textContent = '';
  body.classList.remove('solved');
  body.classList.add('building');

  const cells = director.cells = new Cells();
  const walls = director.walls = new Walls();

  const from = chooseFrom(cells.all)
  from.maze = true;
  await walks[algorithm](cells, walls, from);

  const start = Math.random() * maxP | 0;
  const end = Math.random() * 8 | 0;

  await walls.get('c', maxC).remove(start);
  await walls.get('c', 2).remove(end);

  const currentCell = solve(cells, start, end);
  
  body.classList.remove('building');
  director.setTo(currentCell);
}

const body = document.querySelector('body');
const root = document.querySelector('svg g');

const director = new Director();

init('wilsons');