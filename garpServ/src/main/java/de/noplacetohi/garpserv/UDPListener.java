/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package de.noplacetohi.garpserv;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 *
 * @author thp
 */
public abstract class UDPListener {

    DatagramSocket ds;
    Thread listener;
    final static int PSIZE = 1206;
    ExecutorService exec = Executors.newSingleThreadExecutor();

    public UDPListener(int port) throws SocketException {
        ds = new DatagramSocket(port);
        ds.setSoTimeout(1000);
        listener = new Thread(() -> {
            System.err.println("Starting to listen on " + ds.getLocalSocketAddress());
            int n = 0;
            while (listener != null) {
                byte[] data = new byte[PSIZE];
                var p = new DatagramPacket(data, PSIZE);
                try {
                    ds.receive(p);
                    exec.submit(() -> {
                        hark(p);
                    });
                } catch (SocketTimeoutException ex) {
                    System.err.println("Tick " + n);
                    n++;
                } catch (IOException x) {
                    System.err.println("quitting because Exception " + x.getMessage());
                    listener = null;
                }
            }
            System.err.println("Stopped listening");
        }
        );
    }

    public void start() {
        listener.start();
    }

    public void stop() {
        listener = null;
    }

    public abstract void hark(DatagramPacket p);
}
