#!/bin/sh
exec java -cp target/garpServ-1.0-SNAPSHOT.jar:../../../pipe/sctp4j/target/sctp4j-1.1-SNAPSHOT.jar:../../pipe-java-client/target/pipe-java-client-1.3-NOJNI.jar de.noplacetohi.garpserv.GarpServPipe
