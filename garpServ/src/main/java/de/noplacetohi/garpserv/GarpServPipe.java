/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 */
package de.noplacetohi.garpserv;

import com.phono.srtplight.Log;
import java.net.DatagramPacket;
import java.net.SocketException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiFunction;
import javax.json.JsonArray;
import javax.json.JsonObject;
import pe.pi.client.device.endpoints.core.JsonEndpoint;
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
                    case "lidar-center":
                    case "lidar-left":
                    case "lidar-right":
                        var r = new LidarEndPoint(l, s);
                        allWs.add(r);
                        ret = r;
                        break;
                    case "term":
                        Log.warn("Creating " + l);
                        ret = new TermEndpoint(l, s);
                        break;
                    case "jsontest":
                        Log.warn("Creating test json recever");
                        ret = new JsonTestEndpoint(s);
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
            MSOPParser parser = new MSOPParser();

            listener = new UDPListener(port) {
                @Override
                public void hark(DatagramPacket p) {
                    var blocks = parser.parse(p);
                    var first = blocks.getFirst();

                    //Log.info("az = "+first.az);
                    allWs.forEach((ws) -> {
                        if (ws.isOpen()) {
                            ws.offer(first.az, p.getData());
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
        private Double[] activeAngle = {0.0, 360.0};
        private final static Double[] center = {100.0, 210.0};
        private final static Double[] left = {0.0, 100.0};
        private final static Double[] right = {210.0, 360.0};
        private final String lab;

        public LidarEndPoint(String l, SCTPStream s) {
            this.stream = s;
            this.lab = l;
            switch (l) {
                case "lidar-center":
                    activeAngle = center;
                    break;
                case "lidar-right":
                    activeAngle = right;
                    break;
                case "lidar-left":
                    activeAngle = left;
                    break;
                case "lidar":
                default:
                    break;
            }
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

        private void offer(Double az, byte[] data) {
            if ((az >= activeAngle[0]) && (az <= activeAngle[1])) {
                if (stream.OutboundIsOpen()) {
                    try {
                        //Log.info("sending to "+lab);
                        stream.send(data);
                    } catch (Exception ex) {
                        Log.error("can't send");
                    }
                }
            }
        }
    }

    private static class JsonTestEndpoint extends JsonEndpoint {

        public JsonTestEndpoint(SCTPStream s) {
            super(s);
        }
        @Override
        public void onMessage(SCTPStream stream, String string) {
            Log.info("message is "+string.length()+" chars long");
            super.onMessage(stream, string);
        }
        @Override
        public JsonObject onJsonMessage(JsonObject messj) {
            Log.info("got json message");
            JsonArray blocks = messj.getJsonArray("blocks");
            JsonObject block = blocks.getJsonObject(0);
            var az = block.getJsonNumber("azimuth");
            var ts = block.getInt("stamp");

            Log.info("az = " + az.doubleValue() + " ts = " + ts);
            return messj;
        }
    }
}
