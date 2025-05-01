/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 */
package de.noplacetohi.garpserv;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.SocketException;

/**
 *
 * @author thp
 */
public class GarpServ {

    public static void main(String[] args) {
        int port = 2368;
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }
        UDPListener l = null;
        MSOPParser msop = new MSOPParser();
        try {
            l = new UDPListener(port) {
                @Override
                public void hark(DatagramPacket p) {
                   System.err.println( "got packet from "+p.getAddress());
                   msop.parse(p);
                }
            };
            l.start();
        } catch (SocketException ex) {
            System.err.println("Can't listen on port " + port);
        }
        boolean done = false;
        while (!done) {
            try {
                var q = System.in.read();
                if (q == 'q');
            } catch (IOException ex) {
                done = true;
            }
        }
        if (l != null) {
            l.stop();
        }

    }
}
