#define DEBUG
#define LOCAL
#import "src/game/constants.asm" 
.encoding "petscii_mixed"



*=$0801

:BasicUpstart2(start)

.pc = $0820
start:
    print(CLEAR_HOME_CASE_SENSE)
    jsr checkU64
    lda type
    cmp #$ff
    beq isU64
    print(txtOnlyForU64BasedDevices)
    rts
isU64:
    jsr prepare
    //print(txtConnectSocket)
    //print(CRLF)
    jsr connectUdpSocket
    //print(statusDataBuffer)
    //print(CRLF)
    lda socket
    cmp #$00
    bne typePlayerName
    jsr closeSocket
    rts
typePlayerName:
    print(txtPlayerName)
    jsr clearInput
inputLoop:
    jsr inputString
    ldx #$00
displayLoop:
    cpx inputLength
    beq displayDone
    lda inputBuffer,x
    sta NET_CMD_START+5,x
    sta $0428,x
    inx
    jmp displayLoop
displayDone:
    lda inputComplete
    beq inputLoop
doSendStart:
    //print(txtWriteSocket)
    //print(CRLF)
    jsr sendStart
    //print(statusDataBuffer)
    //print(CRLF)
    lda status
    cmp #$00
    bne doHandleResponse
    jsr closeSocket
    rts
doHandleResponse:
    jsr handleResponse
loop:
    lda $dc02
    pha
    lda $dc03  
    pha
    
    lda #$ff
    sta $dc02
    lda #$00
    sta $dc03
    
    lda #%11111011
    sta $dc00
    nop
    nop
    lda $dc01
    sta kr2
  
    lda #%01111111
    sta $dc00
    nop
    nop
    lda $dc01
    sta kr7
    lda #$ff
    sta $dc00
    pla
    sta $dc03
    pla  
    sta $dc02

checkExit:
    lda kr7
    and #%10000000 // Run/Stop - Exit & Disconnect
    bne checkReset
    jsr sendExit
    jsr handleResponse
    lda $0400
    cmp #$ff
    bne checkReset
    jsr closeSocket
    rts
checkReset:
    lda kr2
    and #%00000010 // (R)eset
    beq keyIsPressed
    lda #$00
    sta keyPressed
    jmp checkJoystick
keyIsPressed:
    lda keyPressed
    bne checkJoystick
    lda #$01
    sta keyPressed
    jsr sendReset
    jsr handleResponse
checkJoystick:
    lda #$0c
    sta $d027 //n
    sta $d028 //w
    sta $d029 //e
    sta $d02a //s
   
n:
    lda $0400
    and #%00000001
    beq s
    lda #$07
    sta $d027
s:
    lda $0400
    and #%00000010
    beq w
    lda #$07
    sta $d02a
w:
    lda $0400
    and #%00000100
    beq e
    lda #$07
    sta $d028
e:
    lda $0400
    and #%00001000
    beq a
    lda #$07
    sta $d029
    
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
    cmp #$1e
    bne checkSouth
    lda $0400
    and #%00000001
    beq checkSouth
    lda #78  //'N' North
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    jmp noAction
checkSouth:
    lda joyValue
    cmp #$1d
    bne checkWest
    lda $0400
    and #%00000010
    beq checkWest
    lda #83//'S' South
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    jmp noAction
checkWest:
    lda joyValue
    cmp #$1b
    bne checkEast
    lda $0400
    and #%00000100
    beq checkEast
    lda #87//'W' West
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    jmp noAction
checkEast:
    lda joyValue
    cmp #$17
    bne checkNorthFire
    lda $0400
    and #%00001000
    beq checkNorthFire
    lda #69//'E' East
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    jmp noAction
checkNorthFire:
    lda joyValue
    cmp #$0e
    bne checkSouthFire
    //lda $0400
    //and #%0000100
    //beq checkSouthFire
    lda #85//'U' Up
    sta NET_CMD_WALK+4
    inc $d020
    jsr sendWalk
    jsr handleResponse
    jmp noAction
checkSouthFire:
    lda joyValue
    cmp #$0d
    bne noAction
    //lda $0400
    //and #%0000100
    //beq noAction
    lda #68//'D' Down
    sta NET_CMD_WALK+4
    jsr sendWalk
    jsr handleResponse
    jmp noAction
/*
checkFire:
    lda joyValue
    and #$10
    bne noAction
    //jsr sendExit
    //jsr handleResponse
    lda $0400
    cmp #$ff
    bne noAction
    jsr closeSocket
    rts
*/
noAction:
exit:
    jmp loop


joyValue:
.byte $00
joyState:
.byte $00

blocked:
.byte $00

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
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_START:
    .byte $03,$11,$00,$01,$00
    .text "GUIDO"
    .byte $00,$00,$00,$00,$00,$00,$00
NET_CMD_START_END:

sendWalk:{
    lda socket
    sta NET_CMD_WALK+2
    sendCommand(NET_CMD_WALK,NET_CMD_WALK_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_WALK:
    .byte $03,$11,$00,$02,$00
NET_CMD_WALK_END:


sendExit:{
    lda socket
    sta NET_CMD_EXIT+2
    sendCommand(NET_CMD_EXIT,NET_CMD_EXIT_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_EXIT:
    .byte $03,$11,$00,$03,$00
NET_CMD_EXIT_END:


sendReset:{
    lda socket
    sta NET_CMD_RESET+2
    sendCommand(NET_CMD_RESET,NET_CMD_RESET_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_RESET:
    .byte $03,$11,$00,$04,$00
NET_CMD_RESET_END:


sendGoUp:{
    lda socket
    sta NET_CMD_UP+2
    sendCommand(NET_CMD_UP,NET_CMD_UP_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_UP:
    .byte $03,$11,$00,$05,$00
NET_CMD_UP_END:

sendGoDown:{
    lda socket
    sta NET_CMD_DOWN+2
    sendCommand(NET_CMD_DOWN,NET_CMD_DOWN_END)
    jsr readData
    jsr readStatusData
    jsr accept
    //print(dataBuffer+2)
    //print(statusDataBuffer)
    //print(CRLF)
    lda dataBuffer
    sta status
    rts
}
NET_CMD_DOWN:
    .byte $03,$11,$00,$06,$00
NET_CMD_DOWN_END:

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

inputString: {
    jsr $ffe4
    cmp #$00
    beq done
    sta lastKey
    cmp #$0d
    beq inputDone
    cmp #$14
    beq doDelete
    lda inputLength
    cmp inputMaxLen
    beq done
    lda lastKey
    cmp #$30
    bcc done
    cmp #$3a
    bcc addChar
    cmp #$41
    bcc done
    cmp #$5b
    bcc addChar
    jmp done
addChar:
    ldx inputLength
    sta inputBuffer,x
    inc inputLength
    jmp done
doDelete:
    lda inputLength
    beq done
    dec inputLength
    ldx inputLength
    lda #$00
    sta inputBuffer,x
    jmp done
inputDone:
    lda #$01
    sta inputComplete
done:
    rts
}

clearInput: {
    lda #$00
    sta inputLength
    sta inputComplete
    ldx #$00
clearLoop:
    sta inputBuffer,x
    inx
    cpx inputMaxLen
    bne clearLoop
    rts
}

// Variables
inputBuffer:
    .fill 14, $00     // Max 40 characters
inputLength:
    .byte $00
inputMaxLen:
    .byte 12
inputComplete:
    .byte $00
lastKey:
    .byte $00

kr0:
    .byte $00
kr2:
    .byte $00
kr7:
    .byte $00
keyPressed:
    .byte $00
txtPlayerName:
    .text "YOUR NAME:"
    .byte $0d,$00    
#import "src/game/ultimate_dos.asm" 
#import "src/game/sprites.asm"
#import "src/game/text.asm" 