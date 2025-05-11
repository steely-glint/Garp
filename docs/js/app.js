let ws;
document.addEventListener('DOMContentLoaded',
  (e) => {
    canvas = document.getElementById("cloud");
    drawme();
    var us = new URL(document.location);
    let deviceId = us.searchParams.get("id");
    PipeDb.whoAmI(function (id) {
      console.log("from " + id + "  to " + deviceId);
      gotId(id, deviceId);
    }, function (err) {
      console.log("could not create identity " + err)
    }, "y");
  });
let jsontest;
function gotId(id, deviceId) {
  duct = new PipeDuct(id);
  console.log("setting deviceId" + deviceId);
  duct.setTo(deviceId);
  duct.connect().then(function (d) {

    let ws =/* duct.createDataChannel("lidar-center",{ordered:false,maxPacketLifeTime:40});

    ws.onopen = (e) => {
      console.log("lidar-center dc opened");
    }
    ws.onmessage = (e) => {
      parseMessage(e.data);
    }
    ws = duct.createDataChannel("lidar-left",{ordered:false,maxPacketLifeTime:4});

    ws.onopen = (e) => {
      console.log("lidar-left dc opened");
    }
    ws.onmessage = (e) => {
      parseMessage(e.data);
    }
    ws = duct.createDataChannel("lidar-right",{ordered:false,maxRetransmits:2});

    ws.onopen = (e) => {
      console.log("lidar-right dc opened");
    }
    ws.onmessage = (e) => {
      parseMessage(e.data);
    }
    /*ws =*/ duct.createDataChannel("lidar");
    ws.onopen = (e) => {
      console.log("lidar dc opened");
    }
    ws.onmessage = (e) => {
      parseMessage(e.data);
    }/**/
    /*jsontest = duct.createDataChannel("jsontest",{ordered:false,maxRetransmits:2});
    jsontest.onmessage = (e) => {
      let j = JSON.parse(e.data);
      console.log("Got json echo "+ j.blocks.length);
    }
    jsontest.onopen = (e) => {
      console.log("jsontest dc opened");
    }*/
  });
}

let minAz = 45;
let maxAz = 315;

function drawme() {
  const ctx = canvas.getContext("2d");
  //ctx.rotate(Math.PI/2.0);
  const w = canvas.width;
  const h = canvas.height;
  const halfx = w / 2;
  const halfy = h / 2;

  ctx.beginPath();
  const x = halfx;
  const y = halfy;
  let startAngle = Math.PI /2.0 ; // Starting point on circle
  let endAngle = startAngle+Math.PI * 2; // End point on circle
  let radius = 10;
  const counterclockwise = false; // clockwise or counterclockwise
  ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
  ctx.fillStyle = `rgb(255, 0, 0)`
  ctx.fill();
  ctx.beginPath();
  let a1 = startAngle+ ((Math.PI * 2 * 45) / 360); // Starting point on circle
  let a2 = startAngle+ ((Math.PI * 2 * 315) / 360); // End point on circle
  ctx.arc(x, y, halfx - 1, a1, a2, counterclockwise);
  ctx.strokeStyle = '#FF0000';
  ctx.stroke();
}

function draw(cloudlet) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height
  let startAngle = Math.PI /2.0 ; // Starting point on circle

  const halfx = w / 2;
  const halfy = h / 2;
  const counterclockwise = false; // clockwise or counterclockwise

  /*if (cloudlet.azimuth == 0){
    ctx.clearRect(0, 0, w, h);
  }*/
  let az = cloudlet.azimuth;

  if ((az >= minAz-4) && (az <= maxAz+4)) {

    // erasure path
    ctx.beginPath();
    ctx.moveTo(halfx, halfy);
    let a1 = startAngle+ ((Math.PI * 2 * minAz) / 360.0);
    let b1 = startAngle+ ((Math.PI * 2 * maxAz) / 360.0);
    let ax = halfx + halfx * Math.cos(a1);
    let ay = halfy + halfy * Math.sin(a1);
    let bx = halfx + halfx * Math.cos(b1);
    let by = halfy + halfy * Math.sin(b1);
    ctx.lineTo(ax, ay);
    ctx.arc(halfx,halfy,halfx,a1,b1,true);
    ctx.lineTo(halfx, halfy);
    ctx.fillStyle = `rgb(200, 200, 225)`
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(halfx, halfy);
    b1 = startAngle+ ((Math.PI * 2 * az) / 360.0);
    a1 = startAngle+ ((Math.PI * 2 * (az + 4.0)) / 360.0);
    ax = halfx + halfx * Math.cos(a1);
    ay = halfy + halfy * Math.sin(a1);
    bx = halfx + halfx * Math.cos(b1);
    by = halfy + halfy * Math.sin(b1);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(halfx, halfy);

    ctx.fillStyle = `rgb(200, 200, 200)`
    ctx.fill();



    cloudlet.data.forEach((pt) => {
      ctx.beginPath();
      let radius = (pt[0] / 120.0) * halfy;
      if (radius < 0.0){radius = radius *-1.0;}
      const x = halfx; // x coordinate
      const y = halfy; // y coordinate
      const a1 = startAngle+((Math.PI * 2 * az) / 360); // Starting point on circle
      const a2 =  startAngle+((Math.PI * 2 * (az + .25)) / 360); // End point on circle
      const counterclockwise = false; // clockwise or counterclockwise
      ctx.arc(x, y, radius, a1, a2, counterclockwise);
      let dark = Math.abs(pt[1]);
      ctx.strokeStyle = `rgb(0, 0, 0)`;
      ctx.lineWidth='4';
      ctx.stroke();
      az += .25;
    })
  }
  drawme();
}

function parseMessage(v) {
  let blocksize = 100;
  let blocksPerPacket = 12;
  let blocks = [];
  for (let i = 0; i < blocksPerPacket; i++) {
    let offs = i * blocksize;
    let block = v.slice(offs, offs + blocksize);
    let blocko = parseBlock(block);
    blocks.push(blocko);
    draw(blocko);
  }
  //jsontest.send(JSON.stringify({blocks:blocks}));
}

function getUnsignedShort(b1, b2) {
  let ret = (b2 << 8) | b1;
  return ret;
}

function getSignedByte(b1) {
  let ret = 0x7f & b1;
  if (b1 & 0x80) {
    ret -= 256;
  }
  return ret;
}

function parseBlock(block) {
  let subblocklen = 6;
  let head = new Uint8Array(block.slice(0, 4));
  let cloudlet = [];
  let timestamp = 0;
  let az = 0.0;
  if ((head[0] == 0xff) && (head[1] == 0xee)) {
    let baz = getUnsignedShort(head[2], head[3]);
    az = baz / 100.0;
    let offs = 4;
    for (let n = 0; n < 16; n++) {
      let vblock = new Uint8Array(block.slice(offs, offs + subblocklen))
      var d1 = getUnsignedShort(vblock[0], vblock[1]);
      var rss1 = getSignedByte(vblock[2]);
      var d2 = getUnsignedShort(vblock[3], vblock[4]);
      var rss2 = getSignedByte(vblock[5]);
      let d = (rss1 > rss2) ? d1 : d2;
      let range = d / 100.0;
      offs += subblocklen;
      let pt = [range, Math.max(rss1, rss2)];
      cloudlet[n] = pt;
    }
    let tsd = block.slice(offs, offs + 4);
    let off = 3
    while (off >= 0) {
      timestamp = (timestamp << 8) | (tsd[off]);
      off--;
    }
  } else if ((head[0] == 0xff) && (head[1] == 0xff)) {
    // skip this non-data.
  } else {
    console.log("invalid flags " + flags);
  }
  return {stamp: timestamp, data: cloudlet, azimuth: az};
}
