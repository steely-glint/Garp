/*
 * soucecode copyright Westhawk Ltd 2014 - all rights reserved.
 */


if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB. Persistent certs feature will not be available.");
}

(function () {

    PipeDb = {
        chromeVersionThatStoresCerts: 53, // sooner hopefully
        db: null,
        getFinger: function (descsdp) {
            var sdp = Phono.sdp.parseSDP(descsdp)
            var myfp = JSON.stringify(sdp.contents[0].fingerprint.print);
            myfp = myfp.split(":").join("");
            myfp = myfp.split('"').join("");
            console.log("fingerprint is " + myfp)
            return myfp;
        },
        cleanDb: function (app, doneCB) {
            var request = indexedDB.deleteDatabase("PipeDb");
            request.onsuccess = function () {
                console.log("Indexdb.deleteDatabase() ok");
            };
            request.onerror = function (event) {
                console.log("Indexdb.deleteDatabase() error is " + event.target.error.message);
            };
            request.onblocked = function (event) {
                console.log("Indexdb.deleteDatabase() blocked.");
            };
        },
        dbDone: function () {
            if (PipeDb.db != null) {
                console.log("close db");
                PipeDb.db.close();
                PipeDb.db = null;
            }
        },
        createCert: function (opts, doneCB) {
            console.log("create a new cert");
            var expires = this.durationToSec(opts) * 1000;
            console.log ("expires is "+expires+ " dur ="+opts.duration);
            var certParams = {
                name: "RSASSA-PKCS1-v1_5",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
                expires: expires
            };

            RTCPeerConnection.generateCertificate(certParams).then(function (cert) {
                    console.log("created a new cert, now store it.");
                    var tx = PipeDb.db.transaction("PipeCert", "readwrite");
                    tx.oncomplete = function () {
                        PipeDb.dbDone();
                        doneCB(cert);
                        console.log("transaction done .");
                    };
                    tx.onerror = function (event) {
                        console.log("transaction error is " + event.target.error.message);
                    };
                    var store = tx.objectStore("PipeCert");
                    var updateRequest = store.put({app: opts.app, cert: cert, timestamp: Date.now()});
                    updateRequest.onsuccess = function () {
                        console.log("cert stored.");
                    };
                    updateRequest.onerror = function (event) {
                        console.log("update error is " + event.target.error.message);
                    };
                }
            );
        },
        findOrCreateCert: function (opts, doneCB) {
            var tx = PipeDb.db.transaction("PipeCert", "readonly");
            tx.onerror = function (event) {
                console.log("Get transaction failed" + JSON.stringify(event));
            };

            var store = tx.objectStore("PipeCert");
            var index = store.index("by_app");
            console.log("Looking for cert in Indexdb");
            var request = index.get(opts.app);
            request.onsuccess = function (ev) {
                //console.log("ev " + JSON.stringify(ev));
                //console.log("request " + JSON.stringify(request));
                //console.log("this " + JSON.stringify(this));
                var matching = ev.target.result;
                if (matching) {
                    var cert = matching.cert;
                    console.log("cert expires.... at " + cert.expires);
                    doneCB(matching.cert);
                } else {
                    console.log("No suitable cert in DB - creating one ");
                    PipeDb.createCert(opts, doneCB);
                }
            };
            request.oncomplete = function (ev) {
                PipeDb.dbDone();
                console.log("Search for cert in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function (event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbDelPrint: function (print, doneCB) {
            PipeDb.openDb(print, PipeDb.delPrint, doneCB);
        },
        delPrint: function (print, doneCB) {
            console.log("delete existing print ");
            var tx = PipeDb.db.transaction("PipeId", "readwrite");
            tx.oncomplete = function () {
                PipeDb.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function (event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("PipeId");
            var updateRequest = store.delete(print);
            updateRequest.onsuccess = function () {
                console.log("print deleted.");
            };
            updateRequest.onerror = function (event) {
                console.log("print delete error is " + event.target.error.message);
            };
        },
        dbAddPrint: function (print, doneCB) {
            PipeDb.openDb(print, PipeDb.addPrint, doneCB);
        },
        addPrint: function (print, doneCB) {
            console.log("Adding a new print ");
            var tx = PipeDb.db.transaction("PipeId", "readwrite");
            tx.oncomplete = function () {
                PipeDb.dbDone();
                doneCB(print);
                console.log("transaction done .");
            };
            tx.onerror = function (event) {
                console.log("transaction error is " + event.target.error.message);
            };
            var store = tx.objectStore("PipeId");
            print.timestamp = Date.now();
            var updateRequest = store.put(print);
            updateRequest.onsuccess = function () {
                console.log("print stored.");
            };
            updateRequest.onerror = function (event) {
                console.log("print insert error is " + event.target.error.message);
            };
        },
        dbIfMaster: function (devid, myid, doneCB) {
            var print = {dev: devid, me: myid};
            PipeDb.openDb(print, PipeDb.ifMaster, doneCB);
        },
        ifMaster: function (fingers, doneCB) {
            var checkMaster = function (data) {
                if (data.owner === fingers.me) {
                    doneCB()
                } else {
                    console.log("not master");
                }
            };
            PipeDb.findPrint(fingers.dev, checkMaster)
        },
        dbFindPrint: function (print, doneCB) {
            PipeDb.openDb(print, PipeDb.findPrint, doneCB);
        },
        findPrint: function (finger, doneCB) {
            var tx = PipeDb.db.transaction("PipeId", "readonly");
            var store = tx.objectStore("PipeId");
            var index = store.index("by_id");
            console.log("Looking for finger in Indexdb");
            var request = index.get(finger);
            request.onsuccess = function (ev) {
                console.log("ev " + JSON.stringify(ev));
                console.log("request " + JSON.stringify(request));
                console.log("this " + JSON.stringify(this));
                var matching = this.result;
                if (matching) {
                    console.log("Returning matched print in DB");
                    doneCB(matching);
                } else {
                    doneCB(null);
                }
            };
            request.oncomplete = function (ev) {
                PipeDb.dbDone();
                console.log("Search for print in DB - complete");
                console.log("ev " + JSON.stringify(ev));
            };
            request.onerror = function (event) {
                console.log("Get failed" + JSON.stringify(event));
            };
        },
        dbListPrint: function (doneCB) {
            PipeDb.openDb("friends", PipeDb.listPrint, doneCB);
        },
        listPrint: function (thing, doneCB) {
            var prints = [];

            var tx = PipeDb.db.transaction("PipeId", "readonly");
            tx.oncomplete = function () {
                PipeDb.dbDone();
                console.log("transaction done .");
                prints.sort(function (a, b) {
                    return b.timestamp - a.timestamp;
                });
                doneCB(prints);
            };
            var store = tx.objectStore("PipeId");

            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    prints.push(cursor.value);
                    cursor.continue();
                }
            };
        },
        openDb: function (opts, action, doneCB) {
            if (PipeDb.db == null) {
                var request = indexedDB.open("PipeProxyDb");
                request.onupgradeneeded = function (ev) {
                    console.log("Indexdb.open() needed upgrade...");
                    console.log("ev " + JSON.stringify(ev));
                    var db = ev.target.result;
                    if ((!ev.oldVersion) || (ev.oldVersion < 1)) {
                        console.log("createObjectStore and  createIndex for new database ");
                        // The database did not previously exist, so create object stores and indexes. var db = request.result;
                        var cstore = db.createObjectStore("PipeCert", {keyPath: "app"});
                        var cappIndex = cstore.createIndex("by_app", "app");
                        var fstore = db.createObjectStore("PipeId", {keyPath: "id"});
                        var fappIndex = fstore.createIndex("by_id", "id");
                    }
                };
                request.onsuccess = function () {
                    console.log("Indexdb.open() ok");
                    PipeDb.db = request.result;
                    PipeDb.db.onerror = function (event) {
                        console.log("DB problem" + JSON.stringify(event));
                    };

                    action(opts, doneCB);
                };
                request.onerror = function (event) {
                    console.log("Indexdb.open() error is " + event.target.error.message);
                };
                request.onblocked = function (event) {
                    // If some other tab is loaded with the database, then it needs to be closed
                    // before we can proceed.
                    console.log("Indexdb.open() open blocked.");
                };
            } else {
                action(opts, doneCB);
            }
        },
// functions to manage the swap between one global id and one id per target device
        hasMe: function (rid){
            return new Promise((resolve, reject) => {
                PipeDb.openDb({app: rid}, (opts,dcb)=> {
                    var tx = PipeDb.db.transaction("PipeCert", "readonly");
                    tx.onerror = function (event) {
                        console.log("Get  me transaction failed" + JSON.stringify(event));
                        reject(event);
                    };

                    var store = tx.objectStore("PipeCert");
                    var index = store.index("by_app");
                    console.log("Looking for"+ rid+"  cert in Indexdb");
                    var request = index.get(opts.app);
                    request.onsuccess = function (ev) {
                        var matching = ev.target.result;
                        if (matching) {
                            var cert = matching.cert;
                            console.log("cert expires.... at " + cert.expires);
                            dcb(matching.cert);
                        } else {
                            dcb(null);
                        }
                    };
                    request.oncomplete = function (ev) {
                        PipeDb.dbDone();
                        console.log("Search for me cert in DB - complete");
                        console.log("ev " + JSON.stringify(ev));
                    };
                }, resolve);                // ...
            });
        },
        delMe: function (id) {
            return new Promise((resolve, reject) => {
                if (!id){
                    id="me";
                }
                console.log("delete cert for "+id);
                PipeDb.openDb({app: id}, (opts, dcb) => {
                    var tx = PipeDb.db.transaction("PipeCert", "readwrite");
                    tx.onerror = function (event) {
                        console.log("Get  me transaction failed" + JSON.stringify(event));
                        reject(event);
                    };
                    var store = tx.objectStore("PipeCert");
                    var request = store.delete(opts.app);
                    request.onsuccess = dcb;
                    request.onerror = reject;
                    request.oncomplete = function (ev) {
                        PipeDb.dbDone();
                        console.log("Search for me cert in DB - complete");
                        console.log("ev " + JSON.stringify(ev));
                    };
                },resolve);
            })
        },
        copyMe: function (rid,sid){
            return new Promise((resolve, reject) => {
                PipeDb.openDb({app: rid}, (opts,dcb)=> {
                    var tx = PipeDb.db.transaction("PipeCert", "readwrite");
                    tx.onerror = function (event) {
                        console.log("Get  me transaction failed" + JSON.stringify(event));
                        reject(event);
                    };

                    var store = tx.objectStore("PipeCert");
                    var index = store.index("by_app");
                    console.log("Looking for"+ rid+"  cert in Indexdb");
                    if (!sid){
                        sid = "me";
                    }
                    var request = index.get(sid);
                    request.onsuccess = function (ev) {
                        var matching = ev.target.result;
                        if (matching) {
                            var cert = matching.cert;
                            console.log("cert expires.... at " + cert.expires);
                            var updateRequest = store.put({app: opts.app, cert: cert, timestamp: Date.now()});
                            updateRequest.onsuccess = function () {
                               dcb(cert);
                            };
                            updateRequest.onerror = function (event) {
                                console.log("update error is " + event.target.error.message);
                                dcb(null);
                            };
                        } else {
                            dcb(null);
                        }
                    };
                    request.oncomplete = function (ev) {
                        PipeDb.dbDone();
                        console.log("Search for me cert in DB - complete");
                        console.log("ev " + JSON.stringify(ev));
                    };
                }, resolve);                // ...
            });
        },
        findOrCreateCertAndDB: function (opts, doneCB) {
            PipeDb.openDb(opts, PipeDb.findOrCreateCert, doneCB);
        },
        addMyCertToPeerConf: function (duration, peerconf, mkpc,rid) {
            PipeDb.findOrCreateCertAndDB({app: rid, duration: duration},
                function (cert) {
                    console.log("got cert for "+rid+ "-> " + cert);
                    peerconf.certificates = [cert];
                    mkpc();
                }
            );
        },
        durationToSec: function (opts) {
            var dur = 'x';
            if (opts.duration) {
                dur = opts.duration;
            }
            var secs = 1;
            switch (dur) {
                case 'y':
                    secs = 365 * 24 * 60 * 60;
                    break;
                case 'm':
                    secs = 31 * 24 * 60 * 60;
                    break;
                case 'w':
                    secs = 7 * 24 * 60 * 60;
                    break;
                case 'd':
                    secs = 24 * 60 * 60;
                    break;
                case 'h':
                    secs = 60 * 60;
                    break;
                case 's':
                    secs = 60;
                    break;
                default:
                    secs = 0;
            }
            console.log("duration is "+dur+" expires in "+secs);
            return secs;
        },


        whoAmI: function (okCB, failCB, duration,rid) {
            console.log("duration is "+duration)
            if (!duration) {
                duration = 'y';
            }
            if (!rid){
                var us = new URL(document.location);
                rid = us.searchParams.get("id");
            }
            PipeDb.hasMe("me").then((cert)=>{
                if(cert != null) {
                    if (window.showStatus) {
                        showStatus("You must <a href='convert.html'>convert</a> this page to continue");
                    }
                    failCB("me exists");
                } else  {
                    PipeDb.findOrCreateCertAndDB({app: rid, duration: duration},
                        function (cert) {
                            console.log("got cert" + cert);
                            if (cert.getFingerprints) {
                                var myfp = cert.getFingerprints()[0].value.toUpperCase().trim();
                                myfp = myfp.split(":").join("");
                                console.log("returning id" + myfp);
                                okCB(myfp, cert.expires);
                            } else {
                                alert("Your browser does not support the full WebRTC spec- cant continue.")
                            }
                        }
                    );
                }
            }).catch(() => {
                failCB("cert db messed up");
            });
        }
    }
}());


function PipeDuct(finger, oldws) {
    this.loc = window.location;
    this.configUrl = "https://dev.pi.pe/pipeconfig.json";
    this.ws = oldws;
    this.wsurl = null;
    this.session = null;
    this.toFinger = null;
    this.myFinger = finger;
    this.peerCon = null;
    this.nonceS = null;
    this.nonsense = "";
    this.candyStash = [];
    this.candyRStash = [];
    this.openTimer;
    this.onextra;
    this.patches = [];
    this.sdpConstraints = {'mandatory': {'OfferToReceiveAudio': false, 'OfferToReceiveVideo': false}};
    this.configuration = {};
    this.pluralCandidates = false;

};
PipeDuct.prototype.printDuration= function(tock,task){
    var diff = Date.now() - tock;
    console.log("Task "+task+" took "+diff+" ms");
}
PipeDuct.prototype.connect = function () {
    var that = this;
    var stamp = Date.now();
    var promise = new Promise(function (resolve, reject) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', that.configUrl, true);
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
                var pipeconfig = JSON.parse(xobj.responseText);
                console.log("Config is "+xobj.responseText);
                if (pipeconfig.ice){
                    that.configuration=pipeconfig.ice;
                    that.configuration.iceServers.unshift({"urls": ["stun:stun4.l.google.com:19302"]});
                    //arguably this should be in pipeconfig - but not everyone needs it
                    // the purpose is to provide safari with an ipv6 capable stun server so it
                    // will unmask a routable v6 address as a candidate - which it won't otherwise do
                    // unless you have mic / camera permissions.
                    that.configuration.iceCandidatePoolSize = 1;

                    console.log("Set ICE params "+JSON.stringify(that.configuration));
                }
                if (pipeconfig.wsurl){
                    that.wsurl = pipeconfig.wsurl;
                    console.log("Set wsurl "+JSON.stringify(that.wsurl));
                }
                if (!that.toFinger){
                    console.log("toFinger not set! Giving up!")
                }
                PipeDb.addMyCertToPeerConf({}, that.configuration, function () {
                    var wcpc = new RTCPeerConnection(that.configuration, null);
                    that.printDuration(stamp,"getting Turn params");
                    that.withPc(wcpc, resolve);
                },that.toFinger);
            }
        };
        xobj.send(null);
    });
    return promise;
};

PipeDuct.prototype.setTurn = function (tsn){
};
PipeDuct.prototype.tohex = function (buffer) {
    var hexCodes = [];
    var view = new DataView(buffer);
    for (var i = 0; i < view.byteLength; i += 4) {
        // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
        var value = view.getUint32(i)
        // toString(16) will give the hex representation of the number without padding
        var stringValue = value.toString(16)
        // We use concatenation and slice for padding
        var padding = '00000000'
        var paddedValue = (padding + stringValue).slice(-padding.length)
        hexCodes.push(paddedValue);
    }

    // Join all the hex strings into one
    return hexCodes.join("");
}
PipeDuct.prototype.setOnextra = function (extract) {
    return this.onextra = extract;
}
PipeDuct.prototype.getWs = function () {
    return this.ws;
}
PipeDuct.prototype.setAnswerPatch = function (patch) {
    this.patches['answer'] = patch;
}

PipeDuct.prototype.makeWs = function (resolve) {
    if (!window.WebSocket) {
        window.WebSocket = window.MozWebSocket;
    }
    if (!window.WebSocket) {
        alert("Your browser does not support Web Sockets.");
        return;
    }
    var that = this;
    var socket, protocol, host;
    protocol = "ws:"
    if (window.location.protocol === "https:") {
        protocol = "wss:"
    }
    host = window.location.host;

    // reuse of existing ws.
    if (this.ws != null) {
        socket = this.ws;
    } else {
        if (!this.wsurl){
            this.wsurl = protocol + "//" + host + "/websocket/?finger=";
        }
        socket = new WebSocket(this.wsurl + this.myFinger);
    }
    if (socket.readyState != 1) {
        socket.onopen = function (event) {
            console.log("wsopen " + JSON.stringify(event));
            resolve(that);
        };
    }
    socket.onclose = function (event) {
        console.log("wsclose " + JSON.stringify(event));
        ws = null;
    };
    socket.onmessage = function (event) {
        console.log("message is " + event.data);
        if (that.openTimer) {
            clearInterval(that.openTimer);
            that.openTimer = null;
        }
        var lines = event.data.split("\n");
        lines.forEach((line) => {
            var data = JSON.parse(line);
            console.log("json line is " + JSON.stringify(data));
            if ((data.cert) && (data.cert.daysRemaining)){
                that.daysRemaining = data.cert.daysRemaining;
            }
            if ((data.type ==="error") && (data.cert)){
                that.certError = data.cert;
                console.log("Cert expired :"+JSON.stringify(data.cert))
            }
            if (data.session) {
                var pc = that.peerCon;
                if ((data.type == 'candidate') && (data.candidate)) {
                    var jc = {
                        sdpMLineIndex: data.sdpMLineIndex,
                        candidate: Phono.sdp.buildCandidate(data.candidate)
                    };
                    var nc = "Huh? ";
                    nc = new RTCIceCandidate(jc);
                    if (pc.signalingState == 'stable') {
                        if (data.candidate.type === "host") {
                            console.log("adding candidate "+ nc.candidate);
                            pc.addIceCandidate(nc);
                        } else {
                            console.log("delaying"+ nc.candidate);
                            window.setTimeout(() => {
                                console.log("adding (delayed)"+ nc.candidate);
                                pc.addIceCandidate(nc);
                                },1000);
                        }
                    } else {
                        console.log("stashing remote")
                        that.candyRStash.push(nc);
                    }
                }
                if ((data.type == 'offer') || (data.type == 'answer')) {
                    var sdp = Phono.sdp.buildSDP(data.sdp);
                    if (data.pluralCandiates) {
                        that.pluralCandidates = true;
                    }
                    if (that.patches[data.type]) {
                        sdp = Phono.sdp.patch(sdp, that.patches[data.type]).sdp;
                    }
                    /*else if (pc.signalingState == 'stable') {
                     console.log("already stable");
                     return;
                     }*/
                    console.log("sent sdp is " + sdp);
                    if (window.showStatus) {
                        showStatus("Got " + data.type);
                    }
                    var message = {'sdp': sdp, 'type': data.type};
                    var rtcd;
                    rtcd = new RTCSessionDescription(message);
                    console.log("rtcd is " + rtcd);
                    that.printDuration(that.oaStamp, "|Pipe| answer");
                    pc.setRemoteDescription(rtcd).then(function () {
                        console.log("set " + data.type + " ok");
                        if (data.type == 'offer') {
                            var theirfp = JSON.stringify(data.sdp.contents[0].fingerprint.print);
                            theirfp = theirfp.split(":").join("");
                            theirfp = theirfp.split('"').join("");
                            console.log("their fingerprint is " + theirfp)
                            that.setTo(theirfp);
                            that.session = data.session;
                            pc.createAnswer().then(function (desc) {
                                pc.setLocalDescription(desc).then(function () {
                                    console.log("Set Local description");
                                    that.sendSDP(pc);
                                }).catch(function (e) {
                                    console.log("Set Local description error " + e);
                                });
                            }).catch(function (e) {
                                console.log("Create answer error " + e);
                            });
                        }
                    }).catch(function (e) {
                        console.log("Set Remote description error " + e);
                    });
                }
                if (data.type == 'extra') {
                    if (data.extra && that.onextra)
                        that.onextra(data.extra);
                }
            } else {
                console.log("no session in my data");
            }
        });
    };
    this.ws = socket;
    if (socket.readyState == 1) {
        resolve(this);
    }
};
PipeDuct.prototype.logError = function (error) {
    console.log(error.name + ": " + error.message);
};

PipeDuct.prototype.mayNeedAudioLater = function (patch) {
    this.sdpConstraints.mandatory.OfferToReceiveAudio = true;
    this.setAnswerPatch(patch);
}
PipeDuct.prototype.withPc = function (pc, promise) {
// send everything to the peer - via fingersmith
    var that = this;
    pc.onicecandidate = function (evt) {
        console.log("local candidate "+JSON.stringify(evt.candidate))
        if (evt.candidate != null) {
            if (pc.signalingState == 'stable') {
                console.log("sending")
                that.sendCandy(evt.candidate);
            } else {
                console.log("stashing")
                that.stashCandy(evt.candidate);
            }
        }
    };
    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
        /*pc.createOffer(function (desc) {
         pc.setLocalDescription(desc, function () {
         console.log("Set Local description");
         that.sendSDP(pc);
         }, that.logError);
         }, that.logError, that.sdpConstraints);
         */
        var stampl = Date.now();

        pc.createOffer().then(function (desc) {
            pc.setLocalDescription(desc).then(function () {
                console.log("Set Local description");
                that.sendSDP(pc);
                that.printDuration(stampl,"sending offer");
                that.oaStamp = Date.now();
            })
        }).catch(function (error) {
            that.logError();
        });
    }
    pc.onsignalingstatechange = function (evt) {
        console.log("signalling state is " + pc.signalingState);
        if (pc.signalingState == 'stable') {
            var can;
            if (that.pluralCandidates){
                that.sendCandies();
                that.candyStash = [];
            } else {
                while (can = that.candyStash.shift()) {
                    console.log("shifting candidate off stash")
                    that.sendCandy(can);
                }
            }
            var nc;
            while (nc = that.candyRStash.shift()) {
                console.log("shifting Remote candidate off stash"+nc.candidate)
                pc.addIceCandidate(nc);
            }
            //that.sendEOC();
        }
    };
    pc.oniceconnectionstatechange = (e) => {
        console.log("ice state is changed", pc.iceConnectionState);
        /*
         "new"	The ICE agent is gathering addresses or is waiting to be given remote candidates through calls to RTCPeerConnection.addIceCandidate() (or both).
         "checking"	The ICE agent has been given one or more remote candidates and is checking pairs of local and remote candidates against one another to try to find a compatible match, but has not yet found a pair which will allow the peer connection to be made. It's possible that gathering of candidates is also still underway.
         "connected"	A usable pairing of local and remote candidates has been found for all components of the connection, and the connection has been established. It's possible that gathering is still underway, and it's also possible that the ICE agent is still checking candidates against one another looking for a better connection to use.
         "completed"	The ICE agent has finished gathering candidates, has checked all pairs against one another, and has found a connection for all components.
         "failed"	The ICE candidate has checked all candidates pairs against one another and has failed to find compatible matches for all components of the connection. It is, however, possible that the ICE agent did find compatible connections for some components.
         "disconnected"	Checks to ensure that components are still connected failed for at least one component of the RTCPeerConnection. This is a less stringent test than "failed" and may trigger intermittently and resolve just as spontaneously on less reliable networks, or during temporary disconnections. When the problem resolves, the connection may return to the "connected" state.
         "closed"
         */
        if (pc.iceConnectionState === "failed"){
        }
        if (pc.iceConnectionState === "connected"){
        }
    };
    this.peerCon = pc;
    pc.ondatachannel = function (evt) {
        if (that.ondatachannel) {
            that.ondatachannel(evt);
        }
    };
    var stamp = Date.now();
    this.makeWs(promise);
    this.printDuration(stamp,"opening websocket");
}


PipeDuct.prototype.createDataChannel = function (name, props) {
    return this.peerCon.createDataChannel(name, props)
}
PipeDuct.prototype.setTo = function (tof) {
    this.toFinger = tof;
    var d = new Date();
    var n = d.getTime();
    this.session = this.myFinger + "-" + tof + "-" + n; // fix this
    console.log("this.toFinger:" + this.toFinger);
};

PipeDuct.prototype.ifMaster = function (todo) {
    var fingers = {me:this.myFinger,dev:this.toFinger};
    PipeDb.ifMaster(fingers,todo);
};

function arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

PipeDuct.prototype.getCert = function (cid, done) {
    var that = this;
    if (this.peerCon.sctp){
        console.log("using sctp transport hook to get cert")
        let rcert = this.peerCon.sctp.transport.getRemoteCertificates()[0];
        done(arrayBufferToBase64(rcert));
    } else {
        this.peerCon.getStats().then(function (res) {
            var retCert = null;
            res.forEach(function (result) {
                console.log(">>>>type>>" + result.type);
                console.log(">>>>id>>>>" + result.id);
                if (result.type === "certificate") {
                    var print = result.fingerprint
                    print = print.split(":").join("");
                    if (print === cid) {
                        retCert = result.base64Certificate;
                        console.log("found matching print ");
                    } else {
                        console.log("skipping print " + print + " is not " + that.toFinger);
                    }
                } else {
                    console.log("Entry ->" + JSON.stringify(result));
                }
            });
            done(retCert);
        });
    }
};
PipeDuct.prototype.addRemote = function (name, page, owner, dur, done) {
    var that = this;
    var printncert = {
        id: that.toFinger,
        cert: "unavailable-firefox-cert",
        name: name,
        page: page,
        owner: owner,
        dur: dur
    };
    this.getCert(this.toFinger, function (s) {
        if (s) {
            printncert.cert = s;
        }
        console.log("adding print+cert " + JSON.stringify(printncert));
        PipeDb.dbAddPrint(printncert, function () {
            console.log("add print done.")
            if (done) {
                done();
            }
        })

    });
};
/*function sha256(str) {
 // We transform the string into an arraybuffer.
 var buffer = new TextEncoder("utf-8").encode(str);
 return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
 return hex(hash);
 });
 } */
PipeDuct.prototype.setNonce = function (n) {
    this.nonceS = n;
    var that = this;
    var sense = this.toFinger + ":" + this.nonceS + ":" + this.myFinger;
    console.log("sense : " + sense);
    var buffer = new TextEncoder("utf-8").encode(sense);
    return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
        that.nonsense = that.tohex(hash).toUpperCase();
    });
};
PipeDuct.prototype.setOnDataChannel = function (callback) {
    this.ondatachannel = function (evt) {
        callback(evt.channel);
    };
};

PipeDuct.prototype.sendSDP = function (pc) {
    var that = this;
    console.log("sdp is :"+pc.localDescription.sdp);
    var sdpObj = Phono.sdp.parseSDP(pc.localDescription.sdp);
    console.log("this.toFinger:" + this.toFinger);
    var sdpcontext = {
        "to": this.toFinger,
        "from": this.myFinger,
        "type": pc.localDescription.type,
        "sdp": sdpObj,
        "session": this.session,
        "nonsense": this.nonsense,
        "retry": 0
    };
    var sendFunc = function () {
        console.log("sending:" + JSON.stringify(sdpcontext));
        that.ws.send(JSON.stringify(sdpcontext));
        if (window.showStatus) {
            showStatus("Sent " + sdpcontext.type + " retry number " + sdpcontext.retry);
        }
        sdpcontext.retry++;
        if (sdpcontext.retry > 5) {
            if (that.openTimer) {
                clearInterval(that.openTimer);
                console.log("given up on:" + JSON.stringify(sdpcontext));
                if (window.showStatus) {
                    showStatus("Giving up on connection");
                }
            }
        }
    };
    if (sdpcontext.type === "offer") {
        this.openTimer = setInterval(sendFunc, 30000);
    }
    sendFunc();
}

PipeDuct.prototype.sendCandy = function (cand) {
    var can_j = Phono.sdp.parseCandidate("a=" + cand.candidate);
    if ((can_j.protocol === "udp") ){
        var candy = {
            "to": this.toFinger,
            "type": 'candidate',
            "candidate": can_j,
            "session": this.session,
            "from": this.myFinger,
            "sdpMLineIndex": cand.sdpMLineIndex,
            "nonsense": this.nonsense

        };
        console.log("send <- " + JSON.stringify(candy))
        this.ws.send(JSON.stringify(candy));
        if (window.show) {
            showStatus("Sending candidates.");
        }
    } else {
        console.log("skipping "+cand.candidate)
    }
};
PipeDuct.prototype.sendEOC = function (cand) {
    var eoc = {
        "to": this.toFinger,
        "type": "end-of-candidates",
        "session": this.session,
        "from": this.myFinger,
        "nonsense": this.nonsense

    };
    console.log("send <- " + JSON.stringify(eoc))

    this.ws.send(JSON.stringify(eoc));
    if (window.showStatus) {
        showStatus("Sending End of Candidates.");
    }
};
PipeDuct.prototype.sendCandies = function () {
    var can_js = this.candyStash.map((c) => Phono.sdp.parseCandidate("a=" + c.candidate));
    if ((can_js) && (can_js.length > 0)) {
        var candy = {
            "to": this.toFinger,
            "type": 'candidate',
            "candidates": can_js,
            "session": this.session,
            "from": this.myFinger,
            "sdpMLineIndex": can_js[0].sdpMLineIndex,
            "nonsense": this.nonsense
        };
        console.log("send <- " + JSON.stringify(candy))

        this.ws.send(JSON.stringify(candy));
        if (window.showStatus) {
            showStatus("Sending many candidates.");
        }
    }
};
PipeDuct.prototype.stashCandy = function (cand) {
    this.candyStash.push(cand);
};


(function () {
    PipeAV = {
        dclabel:"videorelay",
        vc: null,
        onDataMessage: null,
        toggleMedia: function (what,val) {
            if (what == "camera") {
                var video = document.getElementById('ownervideo');
                if (val) {
                    console.log("enable video");
                    this.vc.send(JSON.stringify({type: "cameraon", time: Date.now()}));
                    video.play();
                } else {
                    this.vc.send(JSON.stringify({type: "cameraoff", time: Date.now()}));
                    console.log("disable video");
                    video.pause();
                }
            }
            if (what == "mic") {
                var audio = document.getElementById('owneraudio');
                if (val) {
                    this.vc.send(JSON.stringify({type: "micon", time: Date.now()}));
                    console.log("enable mic");
                    audio.play();
                } else {
                    this.vc.send(JSON.stringify({type: "micoff", time: Date.now()}));
                    console.log("disable mic");
                    audio.pause();
                }
            }
            if (what == "speaker") {
                var trans = duct.peerCon.getTransceivers().find( (t) => {return (t.mid == 'audio');}); // [1].direction = "recvonly";
                var s = trans.sender;
                if (val) {
                    if (!s.track){
                        trans.direction = "sendrecv";
                        this.startGum(s,"audio");
                    } else {
                        s.track.enabled = true;
                    }
                    console.log("enabled speaker");
                } else {
                    s.track.enabled = false;
                    console.log("disabled speaker");
                }
            }
            if (what == "screen") {
                var trans = duct.peerCon.getTransceivers().find( (t) => {return (t.mid == 'video');}); // [1].direction = "recvonly";
                var s = trans.sender;
                if (val) {
                    if (!s.track){
                        trans.direction = "sendrecv";
                        this.startGum(s,"video");
                    } else {
                        s.track.enabled = true;
                    }
                    console.log("enabled screen");
                } else {
                    s.track.enabled = false;
                    console.log("disabled screen");
                }
            }
        },
        addvideopatch: function (mess) {

            var info = mess.info || mess.vinfo;
            console.log("message is " + JSON.stringify(mess))
            mess.patches = [
                {
                    "action": "increment",
                    "at": "o=-",
                    "field": 2
                },
                {
                    "action": "replace",
                    "at": "a=group:BUNDLE",
                    "line": "a=group:BUNDLE " + info.datamid + " video" + (mess.ainfo ? " audio" : "")
                },
                {
                    "action": "replace",
                    "at": "m=application",
                    "line": "m=application 9 DTLS/SCTP 5000"
                },
                {
                    "action": "append",
                    "at": "end",
                    "lines": [
                        "m=video 9 UDP/TLS/RTP/SAVPF " + info.vtype,
                        "a=mid:video",
                        "a="+(info.direction ?"sendonly":info.direction),
                        "a=rtcp-mux",
                        "a=rtpmap:" + info.vtype + " " + info.codec,
                        "a=rtcp-fb:"+ info.vtype + " nack",
                        "a=rtcp-fb:"+ info.vtype + " nack pli",
                        //"a=rtcp-fb:"+ info.vtype + " ccm fir",
                        "a=rtcp-fb:"+ info.vtype + " goog-remb",
                        //"a=rtcp-fb:* ack ccfb",
                        "a=fmtp:" + info.vtype + " packetization-mode=1;profile-level-id="+(info.vprofile?info.vprofile:"42e01f"),
                        //"a=fmtp:" + info.vtype + " packetization-mode=1;profile-level-id=4d4029",
                        "a=ssrc:" + info.csrc + " cname:pipe",
                        "a=ssrc:" + info.csrc + " mslabel:" + info.msid,
                        "a=ssrc:" + info.csrc + " label:" + info.appdata,
                        "a=ssrc:" + info.csrc + " msid:" + info.msid + " " + info.appdata,
                    ]
                },
                {
                    "action": "duplicate",
                    "at": "a=mid:video",
                    "line": "a=fingerprint:"
                },
                {
                    "action": "duplicate",
                    "at": "a=mid:video",
                    "line": "a=ice-ufrag:"
                },
                {
                    "action": "duplicate",
                    "at": "a=mid:video",
                    "line": "a=ice-pwd:"
                },
                {
                    "action": "duplicate",
                    "at": "a=mid:video",
                    "line": "a=setup:"
                },
                {
                    "action": "duplicate",
                    "at": "a=mid:video",
                    "line": "c=IN"
                }
            ];
            if (mess.ainfo) {
                var ainfo = mess.ainfo;
                var apatches = [
                    {
                        "action": "append",
                        "at": "end",
                        "lines": [
                            "m=audio 9 UDP/TLS/RTP/SAVPF " + ainfo.atype,
                            "a=mid:audio",
                            "a="+(ainfo.direction ?"sendonly":ainfo.direction),
                            "a=rtcp-mux",
                            "a=rtpmap:" + ainfo.atype + " " + ainfo.codec,
                            "a=ssrc:" + ainfo.csrc + " cname:pipe",
                            "a=ssrc:" + ainfo.csrc + " mslabel:" + ainfo.msid,
                            "a=ssrc:" + ainfo.csrc + " label:" + ainfo.appdata,
                            "a=ssrc:" + ainfo.csrc + " msid:" + ainfo.msid + " " + ainfo.appdata,
                            "a=fmtp:"+ainfo.atype+" "+(ainfo.samplerate ?
                                "maxplaybackrate="+ainfo.samplerate+"; sprop-maxcapturerate="+ainfo.samplerate+"; maxaveragebitrate=32000; stereo=1; sprop-stereo=1; useinbandfec=1; usedtx=0"
                                :
                                "useinbandfec=1;"),
                            "a=ptime:"+(ainfo.ptime?ainfo.ptime:"20"),
                            "a=maxptime:"+(ainfo.ptime?ainfo.ptime:"20")
                        ]
                    },
                    {
                        "action": "duplicate",
                        "at": "mid:audio",
                        "line": "a=fingerprint:"
                    },
                    {
                        "action": "duplicate",
                        "at": "mid:audio",
                        "line": "a=ice-ufrag:"
                    },
                    {
                        "action": "duplicate",
                        "at": "a=mid:audio",
                        "line": "a=ice-pwd:"
                    },
                    {
                        "action": "duplicate",
                        "at": "a=mid:audio",
                        "line": "a=setup:"
                    },
                    {
                        "action": "duplicate",
                        "at": "a=mid:audio",
                        "line": "c=IN"
                    }
                ];
                mess.patches = mess.patches.concat(apatches);
            }
        },
        startGum: async function (sender,type) {
            var constraints = {video: type=="video", audio: type=="audio"};

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("got stream ");
            var pc = duct.peerCon;
            console.log("pc set");;
            for (const track of stream.getTracks()) {
                if (sender){
                    console.log("replace track on existing sender");;
                    sender.replaceTrack(track);
                } else {
                    console.log("add track - no existing sender");
                    pc.addTransceiver(track, {direction:"sendonly"})
                }
                console.log("added track " + track.kind);
            }
            console.log("added stream ");
        },
        aplay: function (video) {
            var promise = video.play();
            if (promise !== undefined) {
                promise.then(_ => {
                    console.log("autoplay worked");
                    // Autoplay started!
                }).catch(error => {
                    // Autoplay was prevented, mute video and play.
                    video.muted = true;
                    console.log("mute and play");
                    video.play();
                });
            }
        },
        pollBitrate: function (el) {
            var that = this;
            var recs = deviceduct.peerCon.getReceivers();
            if (recs && (recs.length >= 1)) {
                recs[0].getStats().then(data => {
                    data.forEach(v => {
                        if ((v.type == "candidate-pair")&&(v.nominated)){
                            if (that.cpStats) {
                                var dt = v.timestamp - that.cpStats.timestamp;
                                var db = v.bytesReceived - that.cpStats.bytesReceived;
                                if (dt >0) {
                                    var rkbitRate = Math.floor(8 * (db / dt));
                                    var akbitRate = Math.floor(v.availableIncomingBitrate / 1000);
                                    var h = "bitrate=" + rkbitRate + "Kbit/s<br/>availbitrate=" + akbitRate + "Kbit/s";
                                    document.getElementById(el).innerHTML = h;
                                }
                            }
                            that.cpStats = v;
                            let e = document.getElementById(el+"Rtt");
                            if (e){
                                e.innerText = v.currentRoundTripTime;
                            }
                        }
                        if (that.cpStats && (v.type === "remote-candidate") && (that.cpStats.remoteCandidateId == v.id)){
                            let e = document.getElementById(el+"Remote");
                            if (e){
                                e.innerText = v.candidateType;
                            }
                            //$("#"+el+"Remote").text(v.candidateType);
                        }
                        if (that.cpStats && (v.type === "local-candidate") && (that.cpStats.localCandidateId == v.id)){                            let e = document.getElementById(el+"Local");
                            if (e){
                                e.innerText = v.candidateType;
                            }
                            //$("#"+el+"Local").text(v.candidateType);
                        }
                    });
                });
            }
        },
        withMessage: function(vc, message){
            var patched = Phono.sdp.patch(duct.peerCon.remoteDescription.sdp, message);
            console.log("-+>" + JSON.stringify(patched));
            var rtcd = new RTCSessionDescription(patched);
            duct.peerCon.setRemoteDescription(rtcd)
                .then(() => {
                    console.log("set Remote description  ok");
                    return duct.peerCon.createAnswer()
                })
                .then((desc) => {
                    console.log("Create answer ok");
                    return duct.peerCon.setLocalDescription(desc);
                })
                .then(() => {
                    console.log("Set Local description ok");
                    setTimeout(() => {
                        var desc = duct.peerCon.localDescription;
                        var sdp = Phono.sdp.parseSDP(desc.sdp);
                        var mess = {type: desc.type, sdp: sdp, tick: Date.now()};
                        console.log("sending " + JSON.stringify(mess));
                        console.log("to " + vc.label);
                        vc.send(JSON.stringify(mess));
                    }, 100);
                }).catch((e) => {
                console.log("problem" + e);
            });
        },
        videoHere: function (videoEl, aduct, audioEl) {

            var video = document.getElementById(videoEl);
            var audio = null;
            duct = aduct;
            var that = this;
            var stamp = Date.now();

            this.vc = duct.createDataChannel(this.dclabel);
            if (audioEl) {
                var pc = duct.peerCon;
                audio = document.getElementById(audioEl);
                pc.onnegotiationneeded = async () => {
                    console.log("IN Audio ONN");
                    var message = {patches : [{
                        "action": "increment",
                        "at": "o=-",
                        "field": 2
                    }]};
                    var patched = Phono.sdp.patch(duct.peerCon.remoteDescription.sdp, message);
                    patched.type="answer";
                    var rtcd = new RTCSessionDescription(patched);
                    console.log("rtcd is " + rtcd);

                    console.log("-+>" + JSON.stringify(patched));
                    var rtcd = new RTCSessionDescription(patched);
                    await pc.setLocalDescription(await pc.createOffer());
                    console.log("sending ONN to far side");
                    var desc = duct.peerCon.localDescription;
                    var sdp = Phono.sdp.parseSDP(desc.sdp);
                    var mess = {type: "answer", sdp: sdp, tick: Date.now(), debug:"audio onn"}; // lie
                    console.log("sending " + JSON.stringify(mess));
                    console.log("to " + that.vc.label);
                    this.vc.send(JSON.stringify(mess));

                    pc.setRemoteDescription(rtcd);
                };
            }
            this.vc.onopen = function () {
                var upstamp = 0;
                console.log("videorelay channel ");
                duct.printDuration(stamp,"Open av datachannel")
                duct.peerCon.ontrack = function (e) {
                    if (e.track.kind == 'audio') {
                        console.log("got new audio stream");
                        if (audio) {
                            audio.srcObject = e.streams[0];
                            //audio.play();
                        }
                    }
                    if (e.track.kind == 'video') {
                        console.log("got new video stream");
                        duct.printDuration(upstamp,"upgrade to video");
                        video.srcObject = e.streams[0];
                        that.aplay(video);
                    }
                };
                setTimeout(function () {
                    console.log("upgrade gst channel ");
                    upstamp = Date.now();
                    that.vc.send(JSON.stringify({type: "upgrade", time: Date.now()}));
                }, 100);
            };

            this.vc.onmessage = function (evt) {
                var message = JSON.parse(evt.data);
                console.log("->" + JSON.stringify(message));
                if (message.type == "offer" ) {
                    PipeAV.addvideopatch(message);
                    that.withMessage(that.vc,message);
                } else if (message.type == "ok"){
                    console.log("answer accepted")
                } else if (message.type == "data") {
                    if (that.onDataMessage) {
                        that.onDataMessage(message);
                    }
                }
            };
            this.vc.onclose = function () {
            };
        }
    }
}());

/**
 * Created by thp on 12/10/2017.
 */
/*
 <script src="https://pi.pe/iot/js/phono.sdp.js"></script>
 <script src="https://pi.pe/iot/js/pipeDb.js"></script>
 <script src="https://pi.pe/iot/js/pipeDuct.js"></script>
 */

(function () {


    var toId = null;
    var inited = false;
    var failed = false;
    var proxyurls = ["ws://localhost:8181/websocket",
        "ws://localhost:8181/websocket_api",
        "ws://localhost:8181/bin_ws"];

    PipeWs = {
        makeWebSocketProxy: function (to) {
            console.log("Init for |pipe| websocket proxy");
            var resp = new Promise(
                function (resolve, reject) {
                    toId = to;
                    var duct;
                    if (toId && (!failed)) {
                        if (inited) {
                            resolve(duct);
                        } else {
                            PipeDb.whoAmI(id => {
                                    duct = new PipeDuct(id);
                                    duct.webSocketProxy = function (url) {
                                        if (proxyurls.includes(url)) {
                                            console.log("|pipe| will handle " + url);
                                            if (inited) {
                                                console.log("|pipe| not inited yet " + url);
                                                return duct.createDataChannel(url, {});
                                            } else {
                                                return null;
                                            }
                                        } else {
                                            return new WebSocket(url);
                                        }
                                    };
                                    duct.setOnDataChannel((ndc) => {
                                        console.log("Non fatal Error, got incoming datachannel instead of websocket proxy");
                                    });
                                    duct.setTo(toId);
                                    duct.connect().then((d) => {
                                        console.log("|pipe| Duct connected");
                                        inited = true;
                                        resolve(duct);
                                    }).catch(e => {
                                        reject(e)
                                    });

                                },
                                err => {
                                    console.log("could not create identity " + err);
                                    failed = true;
                                    reject("could not create identity " + err);
                                }
                            );
                        }
                    }
                });
            return resp;
        }

    }
}());
/* derived from Phono with original license quoted here */
/*!
 * Copyright 2013 Voxeo Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License.
 *
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
;
(function () {

    // Helper library to translate to and from SDP and an intermediate javascript object
    // representation of candidates, offers and answers

    _parseLine = function (line) {
        var s1 = line.split("=");
        return {
            type: s1[0],
            contents: s1[1]
        }
    }

    _parseA = function (attribute) {
        var s1 = attribute.split(":");
        return {
            key: s1[0],
            params: attribute.substring(attribute.indexOf(":") + 1).split(" ")
        }
    }

    _parseM = function (media) {
        var s1 = media.split(" ");
        return {
            type: s1[0],
            port: s1[1],
            proto: s1[2],
            pts: media.substring((s1[0] + s1[1] + s1[2]).length + 3).split(" ")
        }
    }

    _parseO = function (media) {
        var s1 = media.split(" ");
        return {
            username: s1[0],
            id: s1[1],
            ver: s1[2],
            nettype: s1[3],
            addrtype: s1[4],
            address: s1[5]
        }
    }

    _parseC = function (media) {
        var s1 = media.split(" ");
        return {
            nettype: s1[0],
            addrtype: s1[1],
            address: s1[2]
        }
    }

    //a=candidate:257138899 1 udp 2113937151 192.168.0.151 53973 typ host generation 0
    //a=candidate:1 1 udp 1.0 192.168.157.40 40877 typ host name rtp network_name en0 username root password mysecret generation 0
    /*
     candidate-attribute   = "candidate" ":" foundation SP component-id SP
     transport SP
     priority SP
     connection-address SP     ;from RFC 4566
     port         ;port from RFC 4566
     SP cand-type
     [SP rel-addr]
     [SP rel-port]
     *(SP extension-att-name SP
     extension-att-value)

     foundation            = 1*32ice-char
     component-id          = 1*5DIGIT
     transport             = "UDP" / transport-extension
     transport-extension   = token              ; from RFC 3261
     priority              = 1*10DIGIT
     cand-type             = "typ" SP candidate-types
     candidate-types       = "host" / "srflx" / "prflx" / "relay" / token
     rel-addr              = "raddr" SP connection-address
     rel-port              = "rport" SP port
     extension-att-name    = byte-string    ;from RFC 4566
     extension-att-value   = byte-string
     ice-char              = ALPHA / DIGIT / "+" / "/"
     */
    _parseCandidate = function (params) {
        var candidate = {
            foundation: params[0],
            component: params[1],
            protocol: params[2].toLowerCase(),
            priority: params[3],
            ip: params[4],
            port: params[5]
        };
        var index = 6;
        while (index + 1 <= params.length) {
            if (params[index] == "typ")
                candidate["type"] = params[index + 1];
            if (params[index] == "generation")
                candidate["generation"] = params[index + 1];
            if (params[index] == "username")
                candidate["username"] = params[index + 1];
            if (params[index] == "password")
                candidate["password"] = params[index + 1];
            if (params[index] == "raddr")
                candidate["raddr"] = params[index + 1];
            if (params[index] == "rport")
                candidate["rport"] = params[index + 1];
            index += 2;
        }

        return candidate;
    }

    //a=rtcp:1 IN IP4 0.0.0.0
    _parseRtcp = function (params) {
        var rtcp = {
            port: params[0]
        };
        if (params.length > 1) {
            rtcp['nettype'] = params[1];
            rtcp['addrtype'] = params[2];
            rtcp['address'] = params[3];
        }
        return rtcp;
    }

    //a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:zvrxmXFpomTqz7CJYhN5G7JM3dVVxG/fZ0Il6DDo
    _parseCrypto = function (params) {
        var crypto = {
            'tag': params[0],
            'crypto-suite': params[1],
            'key-params': params[2]
        }
        return crypto;
    }
    _parseFingerprint = function (params) {
        var finger = {
            'hash': params[0],
            'print': params[1],
            'required': '1'
        }
        return finger;
    }

    //a=rtpmap:101 telephone-event/8000"
    _parseRtpmap = function (params) {
        var bits = params[1].split("/");
        var codec = {
            id: params[0],
            name: bits[0],
            clockrate: bits[1]
        }
        if (bits.length > 2) {
            codec.channels = bits[2];
        }
        return codec;
    }
    // a=sctpmap:5000 webrtc-datachannel 256
    _parseSctpmap = function (params) {
        var dc = {
            port: params[0],
            app: params[1],
            count: params[2]
        }
        return dc;
    }

    _parseSsrc = function (params, ssrcs) {
        if (ssrcs == undefined)
            ssrcs = [];
        var sid = params[0];
        var ssrcObj = ssrcs.find(function (s) {
            return s.ssrc == sid;
        });
        if (!ssrcObj) {
            ssrcObj = {ssrc: sid};
            ssrcs.push(ssrcObj);
        }
        var value = params[1];
        ssrcObj[value.split(":")[0]] = value.split(":")[1];
        if ((value.split(":")[0] === "msid") && params[2]) {
            ssrcObj.msid3 = params[2];
        }
        return ssrcs;
    }

    _parseGroup = function (params) {
        var group = {
            type: params[0]
        }
        group.contents = [];
        var index = 1;
        while (index + 1 <= params.length) {
            group.contents.push(params[index]);
            index = index + 1;
        }
        return group;
    }

    _parseMid = function (params) {
        var mid = params[0];
        return mid;
    }
    _parseMidSem = function (params) {
        return params;
    }

    _parseSetup = function (params) {
        var setup = params[0];
        return setup;
    }

    // Object -> SDP

    _buildCandidate = function (candidateObj, iceObj) {
        var c = candidateObj;
        var sdp = "candidate:" + c.foundation + " " +
            c.component + " " +
            c.protocol.toLowerCase() + " " +
            c.priority + " " +
            c.ip + " " +
            c.port;
        if (c.type)
            sdp = sdp + " typ " + c.type;
        if (c.component == 1)
            sdp = sdp + " name rtp";
        if (c.component == 2)
            sdp = sdp + " name rtcp";
        sdp = sdp + " network_name en0";
        if (c.username && c.password) {
            sdp = sdp + " username " + c.username;
            sdp = sdp + " password " + c.password;
            if (!iceObj.ufrag)
                iceObj.ufrag = c.username;
            if (!iceObj.pwd)
                iceObj.pwd = c.username;
            ;
        } else if (iceObj) {
            if (iceObj.ufrag)
                sdp = sdp + " username " + iceObj.ufrag;
            if (iceObj.pwd)
                sdp = sdp + " password " + iceObj.pwd;
        }
        if (c.generation)
            sdp = sdp + " generation " + c.generation;
        if (c.raddr)
            sdp = sdp + " raddr " + c.raddr;
        if (c.rport)
            sdp = sdp + " rport " + c.rport;
        sdp = sdp + "\r\n";
        return sdp;
    }

    _buildSctpmap = function (sctpObj) {
        return "a=sctpmap:" + sctpObj.port + " " + sctpObj.app + " " + sctpObj.count + "\r\n";
    }

    _buildCodec = function (codecObj) {
        var sdp = "a=rtpmap:" + codecObj.id + " " + codecObj.name + "/" + codecObj.clockrate
        if (codecObj.channels) {
            sdp += "/" + codecObj.channels;
        }
        sdp += "\r\n";
        if (codecObj.ptime) {
            sdp += "a=ptime:" + codecObj.ptime;
            sdp += "\r\n";
        }
        if (codecObj.fmtp) {
            sdp += "a=fmtp:" + codecObj.id + " " + codecObj.fmtp + "\r\n";
        }
        if (codecObj.rtcpfbs) {
            codecObj.rtcpfbs.forEach(function (rtcpfb) {
                sdp += "a=rtcp-fb:" + codecObj.id;
                rtcpfb.forEach(function (par) {
                    sdp += " " + par;
                });
                sdp += "\r\n";
            });
        }
        return sdp;
    }

    _buildCrypto = function (cryptoObj) {
        var sdp = "a=crypto:" + cryptoObj.tag + " " + cryptoObj['crypto-suite'] + " " +
            cryptoObj["key-params"] + "\r\n";
        return sdp;
    }

    _buildFingerprint = function (fingerObj) {
        var sdp = "a=fingerprint:" + fingerObj.hash + " " + fingerObj.print + "\r\n";
        return sdp;
    }

    _buildMedia = function (sdpObj) {
        var sdp = "";
        sdp += "m=" + sdpObj.media.type + " " + sdpObj.media.port + " " + sdpObj.media.proto;
        var mi = 0;
        while (mi + 1 <= sdpObj.media.pts.length) {
            var pts = sdpObj.media.pts[mi];
            if ((sdpObj.media.type == "application")
                || sdpObj.codecs.some(function (c) {
                    return pts == c.id;
                })) {
                sdp = sdp + " " + pts;
            }
            mi = mi + 1;
        }
        sdp = sdp + "\r\n";
        if (sdpObj.fingerprint) {
            sdp = sdp + _buildFingerprint(sdpObj.fingerprint);
        }
        if (sdpObj.ice) {
            var ice = sdpObj.ice;
            if (!ice.filterLines) {
                sdp = sdp + "a=ice-ufrag:" + ice.ufrag + "\r\n";
                sdp = sdp + "a=ice-pwd:" + ice.pwd + "\r\n";
            }
            if (ice.options) {
                sdp = sdp + "a=ice-options:" + ice.options + "\r\n";
            }
        }

        if (sdpObj.connection) {
            sdp = sdp + "c=" + sdpObj.connection.nettype + " " + sdpObj.connection.addrtype + " " +
                "0.0.0.0\r\n";
            //sdpObj.connection.address + "\r\n";
        }

        if (sdpObj.mid) {
            sdp = sdp + "a=mid:" + sdpObj.mid + "\r\n";
        }

        if (sdpObj.setup) {
            sdp = sdp + "a=setup:" + sdpObj.setup + "\r\n";
        }

        if (sdpObj.rtcp) {
            sdp = sdp + "a=rtcp:" + sdpObj.rtcp.port + " " + sdpObj.rtcp.nettype + " " +
                sdpObj.rtcp.addrtype + " " +
                sdpObj.rtcp.address + "\r\n";
        }

        var ci = 0;
        while (ci + 1 <= sdpObj.candidates.length) {
            sdp = sdp + "a=" + _buildCandidate(sdpObj.candidates[ci], sdpObj.ice);
            ci = ci + 1;
        }


        if (sdpObj.direction) {
            if (sdpObj.direction == "recvonly") {
                sdp = sdp + "a=recvonly\r\n";
            } else if (sdpObj.direction == "sendonly") {
                sdp = sdp + "a=sendonly\r\n";
            } else if (sdpObj.direction == "none") {
                sdp = sdp;
            } else {
                sdp = sdp + "a=sendrecv\r\n";
            }
        }
        /*else {
         sdp = sdp + "a=sendrecv\r\n";
         } */


        if (sdpObj['rtcp-mux']) {
            sdp = sdp + "a=rtcp-mux" + "\r\n";
        }

        if (sdpObj.crypto) {
            sdp = sdp + _buildCrypto(sdpObj.crypto);
        }

        var cdi = 0;
        while (cdi + 1 <= sdpObj.codecs.length) {
            sdp = sdp + _buildCodec(sdpObj.codecs[cdi]);
            cdi = cdi + 1;
        }

        var sdi = 0;
        while (sdi + 1 <= sdpObj.sctpmap.length) {
            sdp = sdp + _buildSctpmap(sdpObj.sctpmap[sdi]);
            sdi = sdi + 1;
        }

        if (sdpObj.ssrcgroup) {
            var gline = "a=ssrc-group:";
            sdpObj.ssrcgroup.forEach(function (p) {
                gline += p + " ";
            });
            sdp += gline.trim() + "\r\n";
        }

        if (sdpObj.ssrcs) {
            sdpObj.ssrcs.forEach(function (ssrc) {
                if (ssrc.cname)
                    sdp = sdp + "a=ssrc:" + ssrc.ssrc + " " + "cname:" + ssrc.cname + "\r\n";
                if (ssrc.mslabel)
                    sdp = sdp + "a=ssrc:" + ssrc.ssrc + " " + "mslabel:" + ssrc.mslabel + "\r\n";
                if (ssrc.label)
                    sdp = sdp + "a=ssrc:" + ssrc.ssrc + " " + "label:" + ssrc.label + "\r\n";
                if (ssrc.msid)
                    sdp = sdp + "a=ssrc:" + ssrc.ssrc + " " + "msid:" + ssrc.msid + " " + ssrc.msid3 + "\r\n";
            });
        }

        return sdp;
    }

// Entry points

    // Fake Phono for node.js or loose use
    if (typeof Phono == 'undefined') {
        Phono = {
            log: {
                debug: function (mess) {
                    console.log(mess);
                }
            }
        };
    }

    Phono.sdp = {
        simplify: function (sdpObj) {
            // strip the video SDP down to a minimum so a webcam can do it
            var cont = sdpObj.contents.find(function (c) {
                return c.media.type == "video"
            });
            // zapp the fbs
            cont.codecs.forEach(function (c) {
                c.rtcpfbs = [];
            });
            var firstssrc = cont.ssrcgroup[1];
            delete cont['ssrcgroup'];
            cont.ssrcs = cont.ssrcs.filter(
                function (s) {
                    console.log("sid = " + s.sid + " ssrc =" + firstssrc);
                    return s.ssrc == firstssrc;
                }
            );

            return sdpObj;
        },
        filterAudioCodec: function (sdpObj, codecName) {
            var cont = sdpObj.contents.find(function (c) {
                return c.media.type == "audio"
            });
            cont.codecs = cont.codecs.filter(
                function (codec) {
                    return codec.name == codecName;
                });
            return sdpObj;
        },
        filterVideoCodec: function (sdpObj, codecName) {
            var cont = sdpObj.contents.find(function (c) {
                return c.media.type == "video"
            });
            cont.codecs = cont.codecs.filter(
                function (codec) {
                    return codec.name == codecName;
                });
            return sdpObj;
        },
        // apply patch actions to the sdp
        patch: function (sdpString, acts) {
            if (!acts.patches) return acts;
            var sdpLines = sdpString.split("\r\n");
            for (var patchNo in acts.patches) {
                var lpatch = acts.patches[patchNo];
                console.log("act = " + lpatch.action);
                if (lpatch.action == "append") {
                    sdpLines = sdpLines.concat(lpatch.lines);
                } else {
                    var where = sdpLines.length - 1;

                    for (var lno = 0; lno < sdpLines.length; lno++) {
                        var sline = sdpLines[lno];
                        if (sline.startsWith) {
                            if (sline.startsWith(lpatch.at)) {
                                where = lno;
                                break;
                            }
                        } else {
                            console.log("looking where - sline.startsWith not there ");
                            console.log("lpatch = " + JSON.stringify(lpatch));
                        }
                    }
                    console.log("found " + lpatch.at + " at " + where);
                    if (lpatch.action == "prepend") {
                        if (lpatch.line) {
                            sdpLines.splice(where, 0, lpatch.line);
                        }
                        if (lpatch.lines) {
                            var plines = lpatch.lines.reverse();
                            for (var pline in plines) {
                                sdpLines.splice(where, 0, plines[pline]);
                            }
                        }
                    }
                    if (lpatch.action == "increment") {
                        var bits = sdpLines[where].split(" ");
                        var v = parseInt(bits[lpatch.field]);
                        console.log("old v is " + v);
                        v = v + 1;
                        bits[lpatch.field] = "" + v;
                        var line = bits.join(" ");
                        console.log("new line is " + line);
                        sdpLines[where] = line;
                    }
                    if (lpatch.action == "replace") {
                        sdpLines[where] = lpatch.line;
                    }
                    if (lpatch.action == "duplicate") {
                        var withline;
                        for (var sdpLine in sdpLines) {
                            var sline = sdpLines[sdpLine];
                            if (sline.startsWith(lpatch.line)) {
                                withline = sline;
                                break;
                            }
                        }
                        sdpLines.splice(where, 0, withline);
                    }

                }
            }
            var stripped = sdpLines.filter(function (l) {
                return l.length > 0
            });
            var sdp = stripped.join("\r\n") + "\r\n";
            var ret = {type: acts.type, sdp: sdp};
            return ret;
        },
        // sdp: an SDP text string representing an offer or answer, missing candidates
        // Return an object representing the SDP in Jingle like constructs
        parseSDP: function (sdpString) {
            var contentsObj = {};
            contentsObj.contents = [];
            var sessionSDP = {ice: {}};
            var sdpObj = sessionSDP;

            // bug in safari
            var clean = sdpString.replace(/\r/g,"");
            // Iterate the lines
            var diff = sdpString.length - clean.length;
            console.log("removed "+diff+" returns ");
            var sdpLines = clean.split("\n");
            for (var sdpLine in sdpLines) {
                var sline = sdpLines[sdpLine];
                Phono.log.debug("line is " + sline);
                if (typeof sline == "function") {
                    continue;
                }
                var line = _parseLine(sline);

                if (line.type == "o") {
                    contentsObj.session = _parseO(line.contents);
                }
                if (line.type == "m") {
                    // New m-line,
                    // create a new content
                    var media = _parseM(line.contents);
                    sdpObj = {};
                    sdpObj.candidates = [];
                    sdpObj.codecs = [];
                    sdpObj.sctpmap = [];
                    sdpObj.ice = sessionSDP.ice;
                    if (sessionSDP.fingerprint != null) {
                        sdpObj.fingerprint = sessionSDP.fingerprint;
                    }
                    sdpObj.media = media;
                    contentsObj.contents.push(sdpObj);
                }
                if (line.type == "c") {
                    if (sdpObj != null) {
                        sdpObj.connection = _parseC(line.contents);
                    } else {
                        contentsObj.connection = _parseC(line.contents);
                    }
                }
                if (line.type == "a") {
                    var a = _parseA(line.contents);
                    switch (a.key) {
                        case "candidate":
                            var candidate = _parseCandidate(a.params);
                            sdpObj.candidates.push(candidate);
                            break;
                        case "group":
                            var group = _parseGroup(a.params);
                            contentsObj.group = group;
                            break;
                        case "setup":
                            var setup = _parseSetup(a.params);
                            sdpObj.setup = setup;
                            break;
                        case "mid":
                            var mid = _parseMid(a.params);
                            sdpObj.mid = mid;
                            break;
                        case "rtcp":
                            var rtcp = _parseRtcp(a.params);
                            sdpObj.rtcp = rtcp;
                            break;
                        case "rtcp-mux":
                            sdpObj['rtcp-mux'] = true;
                            break;
                        case "fmtp":
                            var codec = sdpObj.codecs.find(function (c) {
                                return c.id == a.params[0];
                            });
                            if (codec) {
                                codec.fmtp = sline.split(" ")[1];
                            }
                            break;
                        case "rtcp-fb":
                            var rtcpfb = a.params.slice(1);
                            var codec = sdpObj.codecs.find(function (c) {
                                return c.id == a.params[0];
                            });
                            if (codec) {
                                if (!codec.rtcpfbs) {
                                    codec.rtcpfbs = [rtcpfb];
                                } else {
                                    codec.rtcpfbs.push(rtcpfb);
                                }
                            }
                            break;
                        case "rtpmap":
                            var codec = _parseRtpmap(a.params);
                            if (codec)
                                sdpObj.codecs.push(codec);
                            break;
                        case "sendrecv":
                            sdpObj.direction = "sendrecv";
                            break;
                        case "sendonly":
                            sdpObj.direction = "sendonly";
                            break;
                        case "recvonly":
                            sdpObj.recvonly = "recvonly";
                            break;
                        case "ssrc-group":
                            sdpObj.ssrcgroup = a.params;
                            break;
                        case "ssrc":
                            sdpObj.ssrcs = _parseSsrc(a.params, sdpObj.ssrcs);
                            break;
                        case "fingerprint":
                            var print = _parseFingerprint(a.params);
                            sdpObj.fingerprint = print;
                            break;
                        case "crypto":
                            var crypto = _parseCrypto(a.params);
                            sdpObj.crypto = crypto;
                            break;
                        case "ice-ufrag":
                            sdpObj.ice.ufrag = a.params[0];
                            break;
                        case "ice-pwd":
                            sdpObj.ice.pwd = a.params[0];
                            break;
                        case "ice-options":
                            sdpObj.ice.options = a.params[0];
                            break;
                        case "sctpmap":
                            var sctp = _parseSctpmap(a.params);
                            if (sctp)
                                sdpObj.sctpmap.push(sctp)
                            break;
                        case "msid-semantic":
                            var midsem = _parseMidSem(a.params);
                            if (contentsObj.group) {
                                contentsObj.group.midSem = midsem;
                            }
                            break;
                    }
                }

            }
            return contentsObj;
        },
        // sdp: an object representing the body
        // Return a text string in SDP format
        buildSDP: function (contentsObj) {
            // Write some constant stuff
            var session = contentsObj.session;
            var sdp =
                "v=0\r\n";
            if (contentsObj.session) {
                var session = contentsObj.session;
                sdp = sdp + "o=" + session.username + " " + session.id + " " + session.ver + " " +
                    session.nettype + " " + session.addrtype + " " + session.address + "\r\n";
            } else {
                var id = new Date().getTime();
                var ver = 2;
                sdp = sdp + "o=-" + " 3" + id + " " + ver + " IN IP4 192.67.4.14" + "\r\n"; // does the IP here matter ?!?
            }

            sdp = sdp + "s=-\r\n" +
                "t=0 0\r\n";
            //sdp = sdp + "a=msid-semantic: WMS SomeArchaneMagicValue\r\n";

            if (contentsObj.connection) {
                var connection = contentsObj.connection;
                sdp = sdp + "c=" + connection.nettype + " " + connection.addrtype +
                    " " + connection.address + "\r\n";
            }
            if (contentsObj.group) {
                var group = contentsObj.group;
                sdp = sdp + "a=group:" + group.type;
                var ig = 0;
                while (ig + 1 <= group.contents.length) {
                    sdp = sdp + " " + group.contents[ig];
                    ig = ig + 1;
                }
                sdp = sdp + "\r\n";
                if (group.midSem) {
                    sdp += "a=msid-semantic:";
                    var im = 0;
                    while (im + 1 <= group.midSem.length) {
                        sdp = sdp + " " + group.midSem[im];
                        im = im + 1;
                    }
                    sdp = sdp + "\r\n";
                }
            }

            var contents = contentsObj.contents;
            var ic = 0;
            while (ic + 1 <= contents.length) {
                var sdpObj = contents[ic];
                sdp = sdp + _buildMedia(sdpObj);
                ic = ic + 1;
            }
            return sdp;
        },
        // candidate: an SDP text string representing a cadidate
        // Return: an object representing the candidate in Jingle like constructs
        parseCandidate: function (candidateSDP) {
            var line = _parseLine(candidateSDP);
            if (line.contents)
                return _parseCandidate(line.contents.substring(line.contents.indexOf(":") + 1).split(" "));
        },
        // candidate: an object representing the body
        // Return a text string in SDP format
        buildCandidate: function (candidateObj) {
            return _buildCandidate(candidateObj);
        }
    };


}());
