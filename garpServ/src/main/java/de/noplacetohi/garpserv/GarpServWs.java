/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 */
package de.noplacetohi.garpserv;

import com.phono.srtplight.Log;
import java.net.DatagramPacket;
import java.net.InetSocketAddress;
import java.net.SocketException;
import java.util.concurrent.CopyOnWriteArrayList;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

/**
 *
 * @author thp
 */
public class GarpServWs extends WebSocketServer {

    static int port = 2368;
    UDPListener listener = null;

    public static void main(String[] args) {
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }
        Log.setLevel(Log.DEBUG);
        String host = "0.0.0.0";

        int httpPort = 8081;

        WebSocketServer server = new GarpServWs(new InetSocketAddress(host, httpPort));
        server.run();
    }

    CopyOnWriteArrayList<WebSocket> allWs;

    private GarpServWs(InetSocketAddress address) {
        super(address);
        Log.debug("ws listen on  " + address);

        allWs = new java.util.concurrent.CopyOnWriteArrayList();
    }

    @Override
    public void onOpen(WebSocket ws, ClientHandshake ch) {
        Log.debug("adding client " + ws.getRemoteSocketAddress());
        allWs.add(ws);
    }

    @Override
    public void onClose(WebSocket ws, int i, String string, boolean bln) {
        Log.debug("deleting client " + ws.getRemoteSocketAddress());
        allWs.remove(ws);
    }

    @Override
    public void onMessage(WebSocket ws, String string) {
        Log.error("not expecting a message");
    }

    @Override
    public void onError(WebSocket ws, Exception excptn) {
        Log.error("exception " + excptn.getMessage() + " removing " + ws.getRemoteSocketAddress());
        allWs.remove(ws);
    }

    @Override
    public void onStart() {
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
}
