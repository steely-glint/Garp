/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 */
package de.noplacetohi.garpserv;

import com.phono.srtplight.Log;
import java.net.DatagramPacket;
import java.net.SocketException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiFunction;
import pe.pi.client.endpoints.proxy.TermEndpoint;
import pe.pi.client.small.App;
import pe.pi.client.small.screen.SmallScreen;
import pe.pi.sctp4j.sctp.SCTPStream;
import pe.pi.sctp4j.sctp.SCTPStreamListener;

/**
 *
 * @author thp
 */
public class GarpServPipe {

    static int port = 2368;
    UDPListener listener = null;

    private static boolean done = false;

    public static void main(String[] args) throws Exception {
        Log.setLevel(Log.INFO); // VERB, DEBUG,INFO, WARN , ERROR 
        System.setProperty("pe.pi.client.small.defaultPage", "garp.html");
        var server = new GarpServPipe();
        server.start();
        String homedir = ".";
        SmallScreen screen = new SmallScreen() {
            @Override
            public void init() throws UnsupportedOperationException {
                Log.debug("inited screen");
            }

            @Override
            public void clearScreen() {
                Log.debug("Clear screen");
            }

            @Override
            public void drawQr(String finger) {
                Log.info("Qr would contain " + finger);
            }

            @Override
            public void showMessage(String message) {
                Log.info("Screen message" + message);
            }

            @Override
            public void setStatus(String s, String s2) {
                Log.info("Status is " + s + s2);
            }

        };

        App.prefixUrl = "https://dev.pi.pe/claim.html";
// function that maps between the label of a requested datachannel and 
// the class it will connect to (if any).
// notice that this uses string constants and switch _not_ regexps or
// dynamic class loading - this for security purposes - no chance of whacky
// i18n 2byte matches in regexps or ../.. paths etc.
// for extra security, create an equivelent java class and compile it.
        BiFunction<String, SCTPStream, SCTPStreamListener> mapper = (l, s) -> {
            Log.info("mapping Datachannel label");
            SCTPStreamListener ret = null;
            try {
                switch (l) {
                    case "lidar":
                        var r = new LidarEndPoint(s);
                        allWs.add(r);
                        ret = r;
                        break;
                    case "term":
                        Log.warn("Creating " + l);
                        ret = new TermEndpoint(l, s);
                        break;
                }
            } catch (Exception x) {
                Log.error("opening label " + l + " caused exception " + x.getMessage());
            }
            return ret;
        };
// kick stuff off...

        App.connectOnce(screen, mapper, homedir, false);
        while (!done) {
            Thread.sleep(100000L);
        }

    }

    static CopyOnWriteArrayList<LidarEndPoint> allWs;

    private GarpServPipe() {
        allWs = new java.util.concurrent.CopyOnWriteArrayList();
    }


    public void start() {
        try {
            listener = new UDPListener(port) {
                @Override
                public void hark(DatagramPacket p) {
                    allWs.forEach((ws) -> {
                        if (ws.isOpen()) {
                            ws.send(p.getData());
                        }
                    });
                }
            };
            listener.start();

        } catch (SocketException ex) {
            System.err.println("Can't listen on port " + port);
        }
    }

    private static class LidarEndPoint implements SCTPStreamListener {

        private final SCTPStream stream;

        public LidarEndPoint(SCTPStream s) {
            this.stream = s;
        }

        @Override
        public void onMessage(SCTPStream stream, String string) {
            Log.error("Not expectin a message to lidar");
        }

        @Override
        public void close(SCTPStream stream) {
            allWs.remove(this);
        }

        private boolean isOpen() {
            return (stream != null) && (stream.OutboundIsOpen());
        }

        private void send(byte[] data) {
            if (stream.OutboundIsOpen()) {
                try {
                    stream.send(data);
                } catch (Exception ex) {
                    Log.error("can't send");
                }
            }
        }
    }
}
