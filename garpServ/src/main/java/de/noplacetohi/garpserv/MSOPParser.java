/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package de.noplacetohi.garpserv;

import com.phono.srtplight.Log;
import java.net.DatagramPacket;
import java.nio.ByteBuffer;
import java.util.ArrayList;

/**
 *
 * @author thp
 */
public class MSOPParser {

    final static int blocklen = 100;

    ArrayList<Block> parse(DatagramPacket p) {
        ArrayList<Block> ret = new ArrayList();

        try {
            ByteBuffer data = ByteBuffer.wrap(p.getData());
            int pos = 0;
            for (int n = 0; n < 12; n++) {
                var block = data.slice(pos, blocklen);
                var b = parseBlock(block);
                if (b != null) {
                    ret.add(b);
                }
                pos += blocklen;
            }
            long ts = readStamp(data, pos);
            //System.err.println(" " + ts);
        } catch (Throwable t) {
            t.printStackTrace();
        }
        return ret;
    }

    private boolean unsignedByteComp(byte a, byte b) {
        return ((a & 0xFF) > (b & 0xFf));
    }

    int getUnsignedShort(ByteBuffer b) {
        byte b1 = b.get();
        byte b2 = b.get();
        int ret = ((b2 & 0xFF) << 8) | (b1 & 0xFF);
        return ret;
    }

    class Measure {

        Double range;
        int rss;
    }

    class Block {

        Double az;
        Measure[] values;
    }

    private Block parseBlock(ByteBuffer block) {
        Block b = null;
        short flags = block.getShort();
        if (flags == (short) 0xFFEE) {
            b = new Block();
            int az = getUnsignedShort(block);

            b.az = az / 100.0;
            b.values = new Measure[16];
            for (int n = 0; n < 16; n++) {
                b.values[n] = new Measure();
                var d1 = getUnsignedShort(block);
                var rss1 = block.get();
                var d2 = getUnsignedShort(block);
                var rss2 = block.get();
                var v = unsignedByteComp(rss1, rss2) ? d1 : d2;
                var r = unsignedByteComp(rss1, rss2) ? rss1 : rss2;
                b.values[n].range = v / 100.0;
                b.values[n].rss = r;
            }
        } else if (flags == (short) 0xFFFF) {
        } else {
            System.err.println("invalid flag =" + Integer.toHexString(flags));
        }
        return b;
    }

    private long readStamp(ByteBuffer b, int pos) {
        long ret = 0;
        int off = 3;
        while (off >= 0) {
            ret = (ret << 8) | (b.get(pos + off) & 0xFF);
            off--;
        }
        return ret;
    }

}
