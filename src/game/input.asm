// Complete KickAssembler program
.pc = $0801 "BASIC Upstart"
BasicUpstart(input_routine)

.pc = $0820 "Program"

.const CHROUT   = $FFD2
.const GETIN    = $FFE4
.const RETURN   = $0D
.const DELETE   = $14
.const MAXLEN   = 40
.const BUFFER   = $0340
.const CSR_UP   = 17
.const CSR_DOWN = 145
.const CSR_LEFT = 157
.const CSR_RIGHT= 29
.const SPACE    = 160
.const LOWER    = 14
.const UPPER    = 142
.const CURSOR   = 100


// input routine with static cursor
// input: x/y = screen position, a = max length
// output: input string at input_buffer

// simple input routine with static cursor
// call with: ldx=column, ldy=row, a=max_length

input_routine:
    sta max_length
    stx cursor_x
    sty cursor_y
    
    lda #$00
    sta input_pos
    
    // clear buffer
    ldx #$00
    lda #$20
clear_buf:
    sta input_buffer,x
    inx
    cpx #$40
    bne clear_buf

show_cursor:
    // calculate screen address
    lda cursor_y
    sta $fb
    lda #$00
    sta $fa
    
    // multiply y by 40
    ldx #$05
mul_loop:
    asl $fa
    rol $fb
    dex
    bne mul_loop
    
    lda $fa
    asl
    sta $fa
    lda $fb
    rol
    sta $fb
    asl $fa
    rol $fb
    
    // add x position
    lda $fa
    clc
    adc cursor_x
    sta $fa
    lda $fb
    adc #$00
    sta $fb
    
    // add screen base
    lda $fa
    clc
    adc #$00
    sta $fa
    lda $fb
    adc #$04
    sta $fb
    
    // show cursor
    ldy #$00
    lda #$a0
    sta ($fa),y

get_key:
    jsr $ffe4
    beq get_key
    
    // check return
    cmp #$0d
    beq done
    
    // check delete
    cmp #$14
    beq do_delete
    
    // check if full
    ldx input_pos
    cpx max_length
    bcs get_key
    
    // validate character
    cmp #$30
    bcc get_key
    cmp #$3a
    bcc add_char
    cmp #$41
    bcc get_key
    cmp #$5b
    bcc add_char
    cmp #$c1
    bcc get_key
    cmp #$db
    bcs get_key

add_char:
    // store in buffer
    ldx input_pos
    sta input_buffer,x
    
    // show on screen
    ldy #$00
    sta ($fa),y
    
    // advance
    inc input_pos
    inc cursor_x
    jmp show_cursor

do_delete:
    ldx input_pos
    beq get_key
    
    // erase cursor
    ldy #$00
    lda #$20
    sta ($fa),y
    
    // go back
    dec input_pos
    dec cursor_x
    
    ldx input_pos
    lda #$20
    sta input_buffer,x
    
    jmp show_cursor

done:
    // erase cursor
    ldy #$00
    lda #$20
    sta ($fa),y
    
    // null terminate
    ldx input_pos
    lda #$00
    sta input_buffer,x
    rts

// variables
input_buffer:   .fill 64, 0
cursor_x:       .byte 0
cursor_y:       .byte 0
input_pos:      .byte 0
max_length:     .byte 0