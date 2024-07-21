//-- Global Variables ------------------
  let sheet;
  let tileDims = [12, 7];
  let tileSize = 256;

  let numTiles = tileDims[0]*tileDims[1];
  let indexLs = (new Array(numTiles)).fill(0).map((e, i) => i);

  let goalBuffer, curBuffer, tmpBuffer, displayBuffer, backgroundBuffer;
  let selectionBuffer;
  let buildCols, buildRows, patternCols, patternRows;
  let displayCols, displayRows;

  //badge coloring offset
  let offset = 0;

  let dirs = [
    [-1, -1], [ 0, -1], [ 1, -1],
    [-1,  0], [ 0,  0], [ 1,  0],
    [-1,  1], [ 0,  1], [ 1,  1],
  ];

  let shelveStops = [.28, .48];
  let shelveWidths = [shelveStops[0], shelveStops[1]-shelveStops[0], 1-shelveStops[1]];
  let shelveMids   = [shelveWidths[0]/2, shelveStops[0]+shelveWidths[1]/2, shelveStops[1]+shelveWidths[2]/2];

  let level = 0;
  let levelAnim = 0;
  let nextLevel = false;

//-- Music -----------------------------
  let music = new Audio("assets/space.wav");
  music.loop = true;
  music.volume = .7;

  let sfxFiles = ["highUp.wav", "laser6.wav", "lowDown.wav", "lowThreeTone.wav", "pepSound3.wav", "phaseJump3.wav", "phaserDown3.wav"];
  let sfx = [];
  for (let name of sfxFiles) sfx.push(new Audio("assets/sfx/"+name));

//-- General Helper Functions ----------
  let idx2Tile = idx => [idx%tileDims[0], floor(idx/tileDims[0])];

  let drawTileAt = (g, idx, x, y, w, h) => {
    let [tx, ty] = idx2Tile(idx);
    g.image(sheet, x, y, w, h, tx*tileSize, ty*tileSize, tileSize, tileSize);
  }

  let screen2Coord = (x, y, cx, cy, cols, rows, s) => {
    let [mx, my] = [x-cx, y-cy];
    [mx, my] = [mx, my].map(i => i/(s*1.2));
    mx += (cols/2);
    my += (rows/2);
    mx /= 6;
    my /= 6;
    return [mx, my];
  }

  //returns the dimensions a grid of n columns x m rows given a number of elements
  //XXX see https://stackoverflow.com/questions/21286967/calculate-number-of-columns-and-rows-needed-depending-on-space-available
  // L=> actualy strike that. That algorithm was crap. An area based solution worked better
  let getRowCols = (w, h, numElems) => {
    let aspect = (h*.25)/w;
    let goalDim = sqrt(w*h/numElems);
    let cols = min(round(w/goalDim), numElems);
    let rows = floor((numElems+cols-1)/cols);
    return [cols, rows];
  }

//-- Puzzle Creation -------------------
  let getPuzzle = (n, tiles=indexLs) => {
    let puzzle = [];
    let tempLs = [...tiles];
    for (let i = 0; i < n; i++){
      let idx = rInt(tempLs.length);
      let tile = tempLs[idx];
      puzzle.push(tile);
      tempLs.splice(idx, 1);
    }
    return puzzle;
  }

  class Puzzle{
    constructor(level){
      let difficulty = 1-(1/(level/10+1)); //recipricol scaling approaches 1
      difficulty = constrain(difficulty, 0, 1);

      this.puzzleSize     = 1+floor(difficulty*8);
      this.numPuzzleTiles = 1+floor(difficulty*numTiles);
      this.puzzleTiles    = getPuzzle(this.numPuzzleTiles);
      this.puzzleSet      = getPuzzle(this.puzzleSize, this.puzzleTiles);
      this.selectionSet   = this.puzzleSet.map(i => -1);
    }
  }

//-- Setup and Initialization ----------
  function preload(){
    sheet = loadImage("assets/patterns.png");
  }

  function setup (){
    pixelDensity(1);
    createCanvas();
    colorMode(HSB, 1, 1, 1);

    let initBuffer = () => {
      let buffer = createGraphics(tileSize, tileSize);
      buffer.colorMode(HSB, 1, 1, 1);
      return buffer;
    }

    curBuffer        = initBuffer();
    goalBuffer       = initBuffer();
    tmpBuffer        = initBuffer();
    displayBuffer    = initBuffer();
    backgroundBuffer = createGraphics(tileSize*3, tileSize);
    backgroundBuffer.colorMode(HSB, 1, 1, 1);

    selectionBuffer = createGraphics(1, 1);

    init();
    windowResized();
  }

  let curPuzzle;
  let backgroundSet = [];
  let lastBackgroundSwap;
  let init = () => {
    curPuzzle     = new Puzzle(level);
    backgroundSet = getPuzzle(3);
    lastBackgroundSwap = 0;
  }

//-- Drawing and Selection -------------
  let renderSetToBuffer = (buffer, sampler, set, useTint=false) => {
    buffer.background(0);
    buffer.push();
    buffer.blendMode(EXCLUSION);
    for(let i = 0; i < set.length; i++){
      let [tx, ty] = idx2Tile(set[i]);
      if (useTint) buffer.tint(fract((level+i)/20+offset), fract((level+i)/10+offset), 1); //coloring the level badge
      buffer.image(sampler, 0, 0, tileSize, tileSize, tx*tileSize, ty*tileSize, tileSize, tileSize);
    }
    buffer.pop();
  }

  let renderToDisplay = (buffer, offsetX, offsetY) => {
    displayBuffer.background(0);
    for (let d of dirs){
      displayBuffer.image(buffer, (fract(offsetX)+d[0])*tileSize, (fract(offsetY)+d[1])*tileSize, tileSize+1, tileSize+1);
    }
  }

  let drawBackgroud = (t) => {
    let amt = t/20;
    if (amt-lastBackgroundSwap > 1){
      backgroundSet.splice(0, 1);
      backgroundSet.push(rInt(numTiles));
      lastBackgroundSwap = floor(amt);
    }

    backgroundBuffer.background(0);
    for (let i = 0; i < backgroundSet.length; i++){
      let [tx, ty] = idx2Tile(backgroundSet[i]);
      backgroundBuffer.image(sheet, i*tileSize, 0, tileSize, tileSize, tx*tileSize, ty*tileSize, tileSize, tileSize)
    }
    backgroundBuffer.noStroke();
    backgroundBuffer.fill(0, fract(amt));
    backgroundBuffer.rect(0, 0, tileSize, tileSize);
    backgroundBuffer.fill(0, 1-fract(amt));
    backgroundBuffer.rect(tileSize*2, 0, tileSize, tileSize);

    renderSetToBuffer(tmpBuffer, backgroundBuffer, [0, 1, 2]);


    renderToDisplay(tmpBuffer, t/40, -t/80);

    let gw = ceil(width/tileSize);
    let gh = ceil(height/tileSize);
    for (let i = 0; i < gw; i++){
      for (let j = 0; j < gh; j++){
        image(displayBuffer, i*tileSize, j*tileSize, tileSize, tileSize);
      }
    }
    background(0, .5);
  }

  let checkGameState = () => {
    let solved = true;
    for (let i = 0; i < curPuzzle.puzzleSize; i++){
      if (!curPuzzle.selectionSet.includes(curPuzzle.puzzleSet[i])){
        solved = false;
        break;
      }
    }
    if (solved) nextLevel = true;
  }

  let handleSelection = (selectionPixel) => {
    if (nextLevel) return;

    //check for grid clicks
    if (selectionPixel[0] > 0){
      //early return if clicking an empty spot from the puzzle grid
      if (curPuzzle.selectionSet.includes(selectionPixel[0]-1)){
        curPuzzle.selectionSet[curPuzzle.selectionSet.indexOf(selectionPixel[0]-1)] = -1;
        return;
      }

      //find first empty index and set that value to this one
      for (let i = 0; i < curPuzzle.selectionSet.length; i++){
        if (curPuzzle.selectionSet[i] == -1){
          curPuzzle.selectionSet[i] = selectionPixel[0]-1;
          break;
        }
      }
    }

    //check for solution clicks
    if (selectionPixel[1] > 0) curPuzzle.selectionSet[selectionPixel[1]-1] = -1;

    checkGameState();
    processClickEvent = false;
  }

  let drawGame = () => {

    let selectionPixel = selectionBuffer.get(curMouseX, curMouseY);
    if (processClickEvent && selectionPixel[3] == 255){
      handleSelection(selectionPixel);
    }

    selectionBuffer.clear();
    selectionBuffer.blendMode(ADD);
    selectionBuffer.noStroke();
    selectionBuffer.rectMode(CENTER);

    rectMode(CENTER);

    pushPop(() => {
      imageMode(CENTER);

      let renderGridFn = (cols, rows, shelfIdx, numElems, renderFn) => {
        let s = min(width/cols, (height*shelveWidths[shelfIdx])/rows)*.8;
        pushPop(() => {
          let [cx, cy] = [width/2, height*shelveMids[shelfIdx]];
          fullTranslate(cx, cy);
          fullScale(s);

          for (let i = 0; i < rows; i++){
            for (let j = 0; j < cols; j++){
              let cols2 = min(numElems - i*cols, cols);
              if (i*cols + j >= numElems) continue; 
              let [x, y] = [(j+0.5-cols2/2)*1.2, (i+0.5-rows/2)*1.2];
              renderFn(i, j, x, y);
            }
          }
        });
      }
      
      //puzzle tile panel
      renderGridFn(patternCols, patternRows, 2, curPuzzle.numPuzzleTiles, (i, j, x, y) => {
        let idx = i*patternCols+j+1;

        if (!curPuzzle.selectionSet.includes(curPuzzle.puzzleTiles[idx-1])){
          drawTileAt(this, 12, x, y, 1.1, 1.1);
          drawTileAt(this, curPuzzle.puzzleTiles[idx-1], x, y, 1, 1);
        }

        selectionBuffer.fill(curPuzzle.puzzleTiles[idx-1]+1, 0, 0);
        selectionBuffer.rect(x, y, 1.1, 1.1);

        if ((selectionPixel[3] == 255) && (curPuzzle.puzzleTiles[idx-1]+1) == selectionPixel[0]){
          fill(0, 1, 1, .5);
          noStroke();
          rect(x, y, 1.1, 1.1);
        }
      });

      //current selection panel
      renderGridFn(buildCols, buildRows, 1, curPuzzle.puzzleSize, (i, j, x, y) => {
        let idx = i*patternCols+j+1;
        drawTileAt(this, 12, x, y, 1.1, 1.1);
        if (curPuzzle.selectionSet[idx-1] != -1) drawTileAt(this, curPuzzle.selectionSet[idx-1], x, y, 1, 1);
        selectionBuffer.fill(0, idx, 0);
        selectionBuffer.rect(x, y, 1.1, 1.1);
        if (selectionPixel[3] == 255 && idx == selectionPixel[1]){
          fill(0, 1, 1, .5);
          noStroke();
          rect(x, y, 1.1, 1.1);
        }
      });

      //goal and preview panel
      renderGridFn(displayCols, displayRows, 0, 2, (i, j, x, y) => {   
        drawTileAt(this, 12, x, y, 1.1, 1.1);
        let idx = i*patternCols+j+1;
        pushPop(() => {
          translate(x, y);
          scale(1+pow(levelAnim, 2)*10);
          rotate(pow(levelAnim, 3)*4);
          blendMode(EXCLUSION);
          if (idx == 1) image(goalBuffer, 0, 0, 1, 1);
          if (idx == 2) image(curBuffer, 0, 0, 1, 1);
        });
      })
    });
  }

//-- Main Draw Function ----------------
  function draw(){
    background(0);

    if (nextLevel) levelAnim += .008;

    if (levelAnim >= 1){
      level++;
      curPuzzle = new Puzzle(level);
      nextLevel = false;
      levelAnim = 0;
      recalculateGrids();
    }

    let t = performance.now()/1000;
    let ox = -t/20;
    let oy =  t/40;

    drawBackgroud(t);

    renderSetToBuffer(goalBuffer, sheet, curPuzzle.puzzleSet);
    renderToDisplay(goalBuffer, ox, oy);
    goalBuffer.image(displayBuffer, 0, 0);

    renderSetToBuffer(curBuffer, sheet, curPuzzle.selectionSet);
    renderToDisplay(curBuffer, ox, oy);
    curBuffer.image(displayBuffer, 0, 0);

    if (nextLevel) background(0, pow(levelAnim, .5));

    drawGame();
   
    //draw level badge
    let arr = [];
    let binString = (level >>> 0).toString(2);
    for (let i = 0; i < binString.length; i++){
      if (binString.charAt(binString.length-i-1) == '1') arr.push(i);
    }


    renderSetToBuffer(tmpBuffer, sheet, arr, true);
    let s = min(width/displayCols, (height*shelveWidths[0])/displayRows)*.3;

    push();
    imageMode(CENTER);
    translate(0, shelveWidths[0]*height);
    drawTileAt(this, 12, s, 0, s*1.1, s*1.1);
    image(tmpBuffer, s, 0, s, s);
    pop();


    // image(selectionBuffer, 0, 0);

    processClickEvent = false;
  }

//-- Mouse Input -----------------------
  let curMouseX = 0;
  let curMouseY = 0;
  let mouseDown = false;
  let processClickEvent = false;

  window.onpointerdown = evt => {
    [curMouseX, curMouseY] = [evt.clientX, evt.clientY];
    if (music.paused) music.play();
    mouseDown = true;
  }

  window.onpointerup = evt => {
    mouseDown = false;
    processClickEvent = true;
    let note = random(sfx);
    note.volume = .3;
    note.play();
  }

  window.onpointermove = evt => {
    [curMouseX, curMouseY] = [evt.clientX, evt.clientY];
  }

//-- Resize ----------------------------
  let recalculateGrids = () => {
    [displayCols, displayRows] = getRowCols(width, height*shelveWidths[0],  2);
    [buildCols  , buildRows  ] = getRowCols(width, height*shelveWidths[1], curPuzzle.puzzleSize);
    [patternCols, patternRows] = getRowCols(width, height*shelveWidths[2], curPuzzle.numPuzzleTiles);
  }

  function windowResized(){
    resizeCanvas(windowWidth, windowHeight);
    selectionBuffer.resizeCanvas(width, height);
    recalculateGrids();
  }

//-- Utils -----------------------------
  let fullScale       = (s)    => {scale(s); selectionBuffer.scale(s);}
  let fullTranslate   = (x, y) => {translate(x, y); selectionBuffer.translate(x, y);}
  let pushPop = f => {push();selectionBuffer.push();f();pop();selectionBuffer.pop();}
  let r       = Math.random;
  let rInt    = n => floor(r()*n);