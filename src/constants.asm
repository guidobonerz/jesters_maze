.const STROUT                = $ab1e
.const CONTROL_REG	         = $df1c
.const STATUS_REG		     = $df1c
.const DATA_REG              = $df1d
.const ID_REG                = $df1d
.const RESP_DATA_REG         = $df1e
.const STATUS_DATA_REG       = $df1f
.const JOYSTICK_PORT2        = $dc00
.const CMD_POINTER           = $9e
.const CMD_POINTER_END       = $a5
.const CMD_POINTER_END_COPY  = $a9


.const JOY_UP    = %00001
.const JOY_DOWN  = %00010
.const JOY_LEFT  = %00100
.const JOY_RIGHT = %01000
.const JOY_FIRE  = %10000

.const JOY_OLD = $fb
.const JOY_BLOCKED = $fc

.const DATA_BUFFER_SIZE	     = 1792
.const STATUS_QUEUE_SIZE     = 512
.const nx=160
.const ny=90