/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package de.noplacetohi.garpserv;

import java.net.DatagramPacket;
import java.nio.ByteBuffer;

/**
 *
 * @author thp
 */
public class MSOPParser {

    final static int blocklen = 100;

    void parse(DatagramPacket p) {

        ByteBuffer data = ByteBuffer.wrap(p.getData());
        int pos = 0;
        for (int n = 0; n < 12; n++) {
            var block = data.slice(pos, blocklen);
            parseBlock(block);
            pos += blocklen;
        }
        long ts = readStamp(data,pos);
        System.err.println(" "+ts);
    }

    private boolean unsignedByteComp(byte a, byte b) {
        return ((a & 0xFF) > (b & 0xFf));
    }

    
    int getUnsignedShort(ByteBuffer b){
        byte b1 = b.get();
        byte b2 = b.get();
        int ret = ((b2 & 0xFF) << 8) | (b1 & 0xFF);
        return ret;
    }
    
    private void parseBlock(ByteBuffer block) {
        short flags = block.getShort();
        if (flags == (short) 0xFFEE) {
            int az = getUnsignedShort(block);
            
            System.err.print(((int) az)/100.0);
            for (int n = 0; n < 16; n++) {
                var d1 = getUnsignedShort(block);
                var rss1 = block.get();
                var d2 = getUnsignedShort(block);
                var rss2 = block.get();
                var v = unsignedByteComp(rss1, rss2) ? d1 : d2;
                Double range = v / 100.0;
                System.err.print(" " + range);
            }
            System.err.println();
        } else if (flags == (short) 0xFFFF) {
        } else {
            System.err.println("invalid flag =" + Integer.toHexString(flags));
        }
    }

    private long readStamp(ByteBuffer b, int pos) {
        long ret = 0;
        int off =3;
        while (off >=0 ){
            ret = (ret <<8) |( b.get(pos+off) & 0xFF);
            off--;
        }
        return ret;
    }

}
