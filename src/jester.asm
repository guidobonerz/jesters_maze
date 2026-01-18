#import "src/constants.asm" 
.encoding "petscii_mixed"
.macro print(text){
    pha
    txa                     
    pha
    tya
    pha
    php
    lda #<text
    ldy #>text
    jsr STROUT
    plp
    pla
    tay
    pla
    tax
    pla
}


*=$0801

:BasicUpstart2(start)

.pc = $0820
start:
    jsr prepare
    print(txtConnectSocket)
    print(CRLF)
    jsr connectUdpSocket
    print(statusDataBuffer)
    print(CRLF)
    lda socket
    cmp #$00
    bne doSendStart
    jsr closeSocket
    rts
doSendStart:
    print(txtWriteSocket)
    print(CRLF)
    jsr sendStart
    print(statusDataBuffer)
    print(CRLF)
    lda status
    cmp #$00
    bne doHandleResponse
    
    jsr closeSocket
    rts
doHandleResponse:
    jsr handleResponse
loop:
    lda #$0c
    sta $d027 //n
    sta $d028 //w
    sta $d029 //e
    sta $d02a //s
    //lda $0400

//  sta $d015

n:
    lda $0400
    and #%0000001
    beq w
    lda #$07
    sta $d027
w:
    lda $0400
    and #%0000010
    beq e
    lda #$07
    sta $d028
e:
    lda $0400
    and #%0000100
    beq s
    lda #$07
    sta $d029
s:
    lda $0400
    and #%0001000
    beq a
    lda #$07
    sta $d02a
    
a:
    lda $0402
    sta $d020
    jsr waitFrame
    lda JOYSTICK_PORT2
    and #$1F
    cmp joyValue
    beq stateNotChanged
    sta joyValue
    lda #$01
    jmp setState
stateNotChanged:
    lda #$00
setState:  
    sta joyState
    cmp #$01
    beq checkNorth
    jmp exit
checkNorth:
    lda joyValue
    and #$01
    bne checkSouth
    lda #78  //'N'
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    //lda $0400
    //sta $d015
    //inc $d020
    jmp noAction
checkSouth:
    lda joyValue
    and #$02
    bne checkWest
    lda #83//'S'
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    //lda $0400
    //sta $d015
    //inc $d020
    jmp noAction
checkWest:
    lda joyValue
    and #$04
    bne checkEast
    lda #87//'W'
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    //lda $0400
    //sta $d015
    //inc $d020
    jmp noAction
checkEast:
    lda joyValue
    and #$08
    bne checkFire
    lda #69//'E'
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    //lda $0400
    //sta $d015
    //inc $d020
    jmp noAction
checkFire:
    lda joyValue
    and #$10
    bne noAction
    jsr closeSocket
    rts
noAction:
exit:
    jmp loop


joyValue:
.byte $00
joyState:
.byte $00

blocked:
.byte $00
txtUp:
.text "Up"
.byte 13,0
txtDown:
.text "Down"
.byte 13,0
txtLeft:
.text "Left"
.byte 13,0
txtRight:
.text "Right"
.byte 13,0

waitFrame: {
    lda #250
loop:
    cmp $D012
    bne loop
    rts
}

prepare:{
    lda #00
    sta JOY_OLD
    

    lda #$05
    sta $0286
    lda #$80
    sta $07F8
    lda #$81
    sta $07F9
    lda #$82
    sta $07FA
    lda #$83
    sta $07FB

    lda #$00
    sta $d020
    lda #$00
    sta $d021

    lda #$0f
    sta $d025
    lda #$08
    sta $d026
    lda #$07
    sta $d027
    sta $d028
    sta $d029
    sta $d02a

    //arrow 1
    lda #nx-12
    sta $d000
    lda #ny
    sta $d001
    
    // arrow 2
    lda #nx-15-12
    sta $d002
    lda #ny
    sta $d003
    
    // arrow 3
    lda #nx+13-12
    sta $d004
    lda #ny
    sta $d005
    
    // arrow 4
    lda #nx-12
    sta $d006
    lda #ny+7
    sta $d007

    lda #$0f
    sta $d015 // enable
    lda #$0f
    sta $d01c // multicolor
    rts
}

sendStart:{
    lda socket
    sta NET_CMD_START+2
    sendCommand(NET_CMD_START,NET_CMD_START_END)
    jsr readData
    jsr readStatusData
    jsr accept
    print(dataBuffer+2)
    print(statusDataBuffer)
    print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_START:
    .byte $03,$11,$00,$01,$00
NET_CMD_START_END:

sendWalk:{
    lda socket
    sta NET_CMD_WALK+2
    sendCommand(NET_CMD_WALK,NET_CMD_WALK_END)
    jsr readData
    jsr readStatusData
    jsr accept
    print(dataBuffer+2)
    print(statusDataBuffer)
    print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_WALK:
    .byte $03,$11,$00,$02,$00
NET_CMD_WALK_END:

responseCount: .byte 00
handleResponse:{
    lda #$00
    sta uppercase
    sta responseCount
read:    
    lda socket
    sta NET_CMD_SOCKET_READ+2
    lda #$03
    sta NET_CMD_SOCKET_READ+3
    lda #$00
    sta NET_CMD_SOCKET_READ+4
    sendCommand(NET_CMD_SOCKET_READ,NET_CMD_SOCKET_READ_END)
    jsr readData
    jsr readStatusData
    jsr accept
    lda dataBuffer+2 // directions
    sta $0400
    lda dataBuffer+3 // gadgets
    sta $0401
    lda dataBuffer+4 // cell type
    sta $0402
    rts
}
#import "src/ultimate_dos.asm" 

.pc = $2000
sprites:
arrow_up:
.byte $00,$00,$00,$00,$20,$00,$00,$a8
.byte $00,$02,$aa,$00,$03,$a9,$00,$00
.byte $e4,$00,$00,$20,$00,$00,$10,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$87
arrow_left:
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$28,$00
.byte $02,$aa,$aa,$03,$aa,$55,$00,$f9
.byte $00,$00,$04,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$87
arrow_right:
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$28,$00
.byte $aa,$aa,$00,$15,$aa,$90,$00,$e5
.byte $40,$00,$10,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$00,$00,$00,$00,$00,$87
arrow_down:
.byte $00,$00,$00,$00,$00,$00,$00,$00
.byte $00,$00,$20,$00,$00,$20,$00,$00
.byte $20,$00,$00,$20,$00,$00,$20,$00
.byte $00,$20,$00,$00,$a8,$00,$00,$a8
.byte $00,$00,$a8,$00,$02,$aa,$00,$02
.byte $aa,$00,$0a,$aa,$80,$0a,$aa,$80
.byte $0e,$aa,$40,$03,$a9,$00,$00,$e4
.byte $00,$00,$10,$00,$00,$00,$00,$87

