type: .word 0
socket: .byte 00
status: .byte 00
uppercase: .byte 00

.macro sendCommand(cmdStart,cmdEnd){
    pha
    txa                     
    pha
    tya
    pha
    php
    jsr clearBuffer
    lda #<cmdStart
    sta CMD_POINTER
    lda #>cmdStart
    sta CMD_POINTER+1
    lda #<cmdEnd
    sta CMD_POINTER_END
    sta CMD_POINTER_END_COPY
    lda #>cmdEnd
    sta CMD_POINTER_END+1
    sta CMD_POINTER_END_COPY+1
    jsr _sendCommand
    plp
    pla
    tay
    pla
    tax
    pla
}

checkTurboMode:{
    lda $d031
    cmp #$ff
    beq notAvailable
    lda $d031
    and #$0f
    cmp #$00
    beq turboOff
turboOn:
    //print(txtTurboOn)
    rts
turboOff:
    //print(txtTurboOff)
    rts
notAvailable:
    //print(txtTurboModeNotActivatable)
    rts
}

checkU64:{
    lda $df1d
    cmp #$c9 //u64 activated cmd interface 
    beq checkU64_ci_on    
    jmp checkU64_ci_off
checkU64_ci_on:    
    lda #$ff
    sta type
    //print(txtUltimate64ActiveCI)
    jmp checked
checkU64_ci_off:
    cmp #$ff //u64 deactivated cmd interface
    beq u64_ci_off
    jmp normal
u64_ci_off:
    lda #$f0
    sta type
    //print(txtUltimate64InactiveCI)
    jmp checked
normal:    
    //print(txtNormalC64)
    jmp checked
    lda #$00
    sta type
    //log(txtUnkownDevice)
checked:
    rts
}

txtTurboModeNotActivatable:
.text "Turbo mode not activatable"
.byte 13,0
txtTurboOn:
.text "Turbo [ON]"
.byte 13,0
txtTurboOff:
.text "Turbo [OFF]"
.byte 13,0

connectTcpSocket:{
    //print(txtConnectTcpSocket)
    sendCommand(NET_CMD_TCP_SOCKET_CONNECT,NET_CMD_TCP_SOCKET_CONNECT_END)
    jsr readData
    jsr readStatusData
    jsr accept
    lda dataBuffer
    sta socket
    //print(dataBuffer)
    //print(statusDataBuffer)
    //print(CRLF)
    lda readData
    sta status
    rts
}
NET_CMD_TCP_SOCKET_CONNECT:
.byte $03,$07,$86,$fc
.text "10.100.200.227"
.byte 0
NET_CMD_TCP_SOCKET_CONNECT_END:

connectUdpSocket:{
    //print(txtConnectUdpSocket)
    sendCommand(NET_CMD_UDP_SOCKET_CONNECT,NET_CMD_UDP_SOCKET_CONNECT_END)
    jsr readData
    jsr readStatusData
    jsr accept
    lda dataBuffer
    sta socket
    //print(dataBuffer)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_UDP_SOCKET_CONNECT:
    .byte $03,$08,$86,$fc
    .text "10.100.200.227"
    .byte 0
NET_CMD_UDP_SOCKET_CONNECT_END:

counter: .byte 0
skipHeader: .byte 0
markerCount: .byte 0
readSocket:{
    lda #$00
    sta markerCount
    sta skipHeader
    sta counter
    sta uppercase
    //jsr clearTcpResponseBuffer
    //print(txtReadSocket)
read:    
    lda socket
    sta NET_CMD_SOCKET_READ+2
    lda #$01
    sta NET_CMD_SOCKET_READ+3
    lda #$00
    sta NET_CMD_SOCKET_READ+4
    sendCommand(NET_CMD_SOCKET_READ,NET_CMD_SOCKET_READ_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer+2
    inc counter
    ldy skipHeader
    cpy #$01
    bne findMarker
    jmp writeData
findMarker:    
    ldy markerCount
    cpy #$03
    beq markerFound
    cmp #$ff
    bne noMarker
    inc markerCount
noMarker:
    ldy #$00
    sty skipHeader
    jmp read
markerFound:
    ldy #$01
    sty skipHeader
writeData:
    cmp #$00
    beq noMoreDataToRead
    //jsr renderMarkdown
    cmp #$ff
    beq skipChar
    //jsr $FFD2
skipChar:
    jmp read
noMoreDataToRead:
    //print($c000)
    //print(CRLF)
    //print(CRLF)
    //print(statusDataBuffer)
    //print(CRLF)
    rts
}
NET_CMD_SOCKET_READ:
    .byte $03,$10,$00,$08,$00
NET_CMD_SOCKET_READ_END:

writeSocket:{
    //print(txtWriteSocket)
    lda socket
    sta NET_CMD_SOCKET_WRITE+2
    sendCommand(NET_CMD_SOCKET_WRITE,NET_CMD_SOCKET_WRITE_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    rts
}
NET_CMD_SOCKET_WRITE:
    .byte $03,$11,$00
    .text "GET /INFO HTTP/1.1"
    .byte $0D, $0A
    .text "HOST: WWW.MASCHINE1.DE"
    .byte $0D, $0A
    .text "USER-AGENT: ULTIMATE64/1.0"
    .byte $0D, $0A
    .text "ACCEPT: TEXT/PLAIN"
    .byte $0D, $0A
    .text "CHARSET: PETSCII"
    .byte $0D, $0A
    .text "CONNECTION: CLOSE"
    .byte $0D, $0A
    .byte $0D, $0A
NET_CMD_SOCKET_WRITE_END:

closeSocket:{
    
    lda socket
    sta NET_CMD_SOCKET_CLOSE+2
    sendCommand(NET_CMD_SOCKET_CLOSE,NET_CMD_SOCKET_CLOSE_END)
    jsr readData
    jsr readStatusData
    jsr accept
    print(dataBuffer)
    print(statusDataBuffer)
    print(CRLF)
    rts
}
NET_CMD_SOCKET_CLOSE:
.byte $03,$09,$00
NET_CMD_SOCKET_CLOSE_END:

clearBuffer:{
    ldx #$ff
loop:
    lda #$00
    sta dataBuffer,x
    sta statusDataBuffer,x
    dex
    bne loop
    rts
}

commandLength: .word 0

_sendCommand:{
    //log(txtPrepare)    
    lda #$00
    sta commandLength
    sta commandLength+1
calcLength:
    lda CMD_POINTER_END
    cmp CMD_POINTER
    bne doDecrementEndPointer
    lda CMD_POINTER_END+1
    cmp CMD_POINTER+1
    beq resetEndPointer
doDecrementEndPointer:
    sec
    lda CMD_POINTER_END
    sbc #$01
    sta CMD_POINTER_END
    lda CMD_POINTER_END+1
    sbc #$00
    sta CMD_POINTER_END+1
    inc commandLength
    bne calcLength
    inc commandLength+1
    jmp calcLength
resetEndPointer:
    lda CMD_POINTER_END_COPY
    sta CMD_POINTER_END
    lda CMD_POINTER_END_COPY+1
    sta CMD_POINTER_END+1  
    dec commandLength
    ///--------------------
    //log(txtBusy)
    //jsr logStatus
waitForIdle:
    lda STATUS_REG
    and #%00110000
    bne waitForIdle
    //log(txtBusy)
    //--------------------
isIdle:
    //log(txtIdle)
    ldy #$00
    //log(txtWrite)
writeCommand:
    lda (CMD_POINTER),y
    sta DATA_REG
    cpy commandLength
    beq pushCommand
    iny 
    jmp writeCommand
pushCommand:
    //log(txtPush)
    lda CONTROL_REG
    ora #%00000001 // push command
    sta CONTROL_REG
checkForError:
    lda STATUS_REG
    and #%00000100
    beq noError
    //log(txtErrorAbort)
    lda CONTROL_REG
    ora #%00001000 // reset error
    sta CONTROL_REG
    jmp _sendCommand
noError:
waitBusyClear: 
    lda STATUS_REG
    and #%00110000
    cmp #$10
    beq waitBusyClear
exit:
    //print(txtCommandSent)
    //jsr logStatus
    rts
}

//.align $100
readData:{
    //log(txtRead)
    ldx #$00
read:
    lda STATUS_REG
    and #%10000000 // DATA_AV
    cmp #%10000000
    beq hasData
    jmp noMoreData
hasData:
    lda RESP_DATA_REG
    sta dataBuffer,x
    inx
    jmp read
noMoreData:
    inx
    lda #$00
    sta dataBuffer,x // add termination
    rts
}

readStatusData:{
    ldx #$00
read:
    lda STATUS_REG
    and #%01000000 // DATA_AV
    cmp #%01000000
    beq store
    jmp noMoreData
store:    
    //log(txtRead)
    lda STATUS_DATA_REG
    sta statusDataBuffer,x
    inx
    //log(txt)
    jmp read
noMoreData:
    lda #$00
    sta statusDataBuffer,x // add termination
    rts
}

accept:{
    pha
    lda CONTROL_REG
    ora #$02 // DATA_ACC
    sta CONTROL_REG
waitForAcceptance:
    //log(txtWaitACK)
    lda STATUS_REG
    and #$02 // DATA_ACC
    cmp #$00
    bne waitForAcceptance
accepted:
    //log(txtAccepted)
    pla
    rts
}


CRLF:
.byte 13,0
.align $100
dataBuffer:
.fill $ff,0

.align $100
statusDataBuffer:
.fill $ff,0

.align $100
tcpDataBuffer:
.fill $ff,0
