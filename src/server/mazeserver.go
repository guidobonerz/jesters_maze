package main

import (
	"fmt"
	"log"
	"net"
	"os"
)

type Player struct {
	name    string
	address string
	port    int
	x       int
	y       int
	z       int
}

var port = 64646
var playerNo = 0
var mazeWidth = 20
var mazeDepth = 20
var mazeHeight = 3
var routeElement = make(map[string]byte)
var maze1 = [][][]string{{
	{"XX00", "LX30", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "AX20", "XX00", "XX00", "DX00", "BX00", "BX00", "BX00", "BX00", "EX00", "NX30", "EX00", "XX00"},
	{"XX00", "FX00", "BX00", "IX00", "BX00", "BX00", "BX00", "OX00", "FX00", "BX00", "BX00", "GX00", "XX00", "DX00", "BX00", "EX00", "FX00", "EX00", "AX00", "XX00"},
	{"XX00", "LX40", "XX00", "FX00", "EX00", "XX00", "DX00", "BX00", "IX00", "BX00", "EX00", "XX00", "LX40", "FX00", "EX00", "AX00", "XX00", "AX00", "AX00", "XX00"},
	{"XX00", "KX00", "BX00", "BX00", "HX00", "BX00", "GX00", "XX00", "AX00", "DX00", "GX00", "XX00", "KX00", "BX00", "GX00", "AX00", "XX00", "AX00", "AX00", "XX00"},
	{"XX00", "AX63", "XX00", "XX00", "NX00", "BX00", "BX00", "EX00", "AX00", "FX00", "BX00", "BX00", "GX00", "XX00", "XX00", "FX00", "BX00", "GX00", "AX00", "XX00"},
	{"XX00", "AX00", "DX00", "BX00", "BX00", "BX00", "EX00", "FX00", "HX00", "EX00", "DX00", "OX30", "XX00", "NX00", "BX00", "BX00", "BX00", "EX00", "AX00", "XX00"},
	{"XX00", "FX00", "GX00", "XX00", "DX00", "BX00", "GX00", "XX00", "XX00", "FX00", "GX00", "XX00", "DX00", "IX00", "BX00", "BX00", "EX00", "FX00", "HX00", "EX00"},
	{"XX00", "AX00", "XX00", "LX30", "AX00", "XX00", "XX00", "XX00", "DX00", "OX00", "DX00", "EX00", "AX62", "AX00", "XX00", "XX00", "AX00", "XX00", "DX00", "GX00"},
	{"XX00", "AX00", "XX00", "AX00", "FX00", "BX00", "BX00", "IX00", "EX00", "XX00", "AX00", "FX00", "GX00", "FX00", "BX00", "EX00", "AX00", "DX00", "GX00", "XX00"},
	{"DX00", "HX00", "BX00", "HX00", "BX00", "EX00", "LX00", "MX40", "AX00", "DX00", "GX00", "XX00", "DX00", "BX00", "BX00", "GX00", "AX00", "KX00", "BX00", "EX00"},
	{"FX00", "EX00", "XX00", "XX00", "XX00", "KX00", "GX00", "XX00", "FX00", "GX00", "XX00", "XX00", "MX52", "XX00", "DX00", "EX00", "AX00", "FX00", "EX00", "MX00"},
	{"XX00", "MX00", "DX00", "BX00", "IX00", "HX00", "BX00", "BX00", "OX00", "XX00", "DX00", "IX00", "BX00", "BX64", "GX00", "AX00", "AX00", "XX00", "AX00", "XX00"},
	{"XX00", "DX00", "GX00", "XX00", "MX00", "XX00", "XX00", "XX00", "XX00", "XX00", "AX00", "AX00", "XX00", "XX00", "DX00", "GX00", "AX00", "NX40", "JX00", "XX00"},
	{"N400", "JX00", "XX00", "LX00", "XX00", "DX00", "BX61", "BX00", "EX00", "XX00", "AX00", "FX00", "EX00", "XX00", "FX00", "BX00", "GX00", "XX00", "AX00", "XX00"},
	{"XX00", "AX00", "DX00", "HX00", "BX00", "GX00", "XX00", "XX00", "AX00", "XX00", "KX00", "OX40", "AX00", "XX00", "XX00", "XX00", "DX00", "BX00", "GX00", "XX00"},
	{"XX00", "AX00", "AX00", "XX00", "DX00", "OX51", "LX00", "XX00", "FX00", "BX00", "GX00", "XX00", "KX00", "OX40", "DX00", "EX00", "FX00", "IX00", "EX00", "XX00"},
	{"DX00", "GX00", "KX00", "BX00", "GX00", "XX00", "FX00", "BX00", "IX00", "EX00", "DX00", "BX00", "JX00", "DX00", "GX00", "AX00", "XX00", "AX00", "MX00", "XX00"},
	{"FX00", "EX00", "AX00", "DX00", "BX00", "BX00", "BX00", "EX00", "AX00", "FX00", "GX00", "DX00", "HX00", "JX00", "XX00", "FX00", "IX00", "GX00", "XX00", "XX00"},
	{"XX00", "AX00", "FX00", "GX00", "XX00", "DX00", "BX00", "GX00", "FX00", "BX00", "BX00", "GX00", "XX00", "MX54", "XX00", "XX00", "FX00", "OX30", "XX00", "XX00"},
	{"XX00", "FX00", "BX00", "OX53", "XX00", "AX10", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00", "XX00"}}}

// routeelement format
// AABC
// AA= path tile
// B = tile type (1=START, 2=END, 3=TREASURE, 4=LAMP OIL, 5=KEY, 6=GATE, 7=RIDDLE)
// C = NUMBER OF KEY or GATE

var players = make(map[string]*Player)

func setupRouteElements() {
	//                       DUEWSN
	routeElement["AX"] = 0b00000011 // │
	routeElement["AU"] = 0b00010011 // │
	routeElement["AD"] = 0b00100011 // │
	routeElement["AB"] = 0b00110011 // │

	routeElement["BX"] = 0b00001100 // ─
	routeElement["BU"] = 0b00011100 // ─
	routeElement["BD"] = 0b00101100 // ─
	routeElement["BB"] = 0b00111100 // ─

	routeElement["CX"] = 0b00001111 // ┼
	routeElement["CU"] = 0b00011111 // ┼
	routeElement["CD"] = 0b00101111 // ┼
	routeElement["CB"] = 0b00111111 // ┼

	routeElement["DX"] = 0b00001010 // ┌
	routeElement["DU"] = 0b00011010 // ┌
	routeElement["DD"] = 0b00101010 // ┌
	routeElement["DB"] = 0b00111010 // ┌

	routeElement["EX"] = 0b00000110 // ┐
	routeElement["EU"] = 0b00010110 // ┐
	routeElement["ED"] = 0b00100110 // ┐
	routeElement["EB"] = 0b00110110 // ┐

	routeElement["FX"] = 0b00001001 // └
	routeElement["FU"] = 0b00011001 // └
	routeElement["FD"] = 0b00101001 // └
	routeElement["FB"] = 0b00111001 // └

	routeElement["GX"] = 0b00000101 // ┘
	routeElement["GU"] = 0b00010101 // ┘
	routeElement["GD"] = 0b00100101 // ┘
	routeElement["GB"] = 0b00110101 // ┘

	routeElement["HX"] = 0b00001101 // ┴
	routeElement["HU"] = 0b00011101 // ┴
	routeElement["HD"] = 0b00101101 // ┴
	routeElement["HB"] = 0b00111101 // ┴

	routeElement["IX"] = 0b00001110 // ┬
	routeElement["IU"] = 0b00011110 // ┬
	routeElement["ID"] = 0b00101110 // ┬
	routeElement["IB"] = 0b00111110 // ┬

	routeElement["JX"] = 0b00000111 // ┤
	routeElement["JU"] = 0b00010111 // ┤
	routeElement["JD"] = 0b00100111 // ┤
	routeElement["JB"] = 0b00110111 // ┤

	routeElement["KX"] = 0b00001011 // ├
	routeElement["KU"] = 0b00011011 // ├
	routeElement["KD"] = 0b00101011 // ├
	routeElement["KB"] = 0b00111011 // ├

	routeElement["LX"] = 0b00000010 // dead north
	routeElement["LU"] = 0b00010010 // dead north
	routeElement["LD"] = 0b00100010 // dead north
	routeElement["LB"] = 0b00110010 // dead north

	routeElement["MX"] = 0b00000001 // dead south
	routeElement["MU"] = 0b00010001 // dead south
	routeElement["MD"] = 0b00100001 // dead south
	routeElement["MB"] = 0b00110001 // dead south

	routeElement["NX"] = 0b00001000 // dead west
	routeElement["NU"] = 0b00011000 // dead west
	routeElement["ND"] = 0b00101000 // dead west
	routeElement["NB"] = 0b00111000 // dead west

	routeElement["OX"] = 0b00000100 // dead east
	routeElement["OU"] = 0b00010100 // dead east
	routeElement["OD"] = 0b00100100 // dead east
	routeElement["OB"] = 0b00110100 // dead east

	routeElement["XX"] = 0b00000000 // empty
}
func main() {
	setupRouteElements()
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", port))
	if err != nil {
		log.Println("Failed to resolve adress:", err)
		os.Exit(1)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Println("Failed to start server:", err)
		os.Exit(1)
	}
	defer conn.Close()

	fmt.Printf("UDP-Server started on port %d\nListening...\n", port)
	buffer := make([]byte, 30)
	for {
		byteCount, clientAddr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			log.Println("Failed to receive:", err)
			continue
		}
		var playerAddress = clientAddr.String()
		log.Printf("%d bytes received / %v\n", byteCount, buffer)
		if byteCount > 0 {
			switch buffer[0] {
			case 1: // register new player
				{
					name := ""
					for i := 2; buffer[i] != 0; i++ {
						/*
							if buffer[i] != 0x20 {
								buffer[i] -= 0x80
							}
						*/
						name = string(append([]byte(name), buffer[i]))
					}

					if _, ok := players[playerAddress]; !ok {
						players[playerAddress] = &Player{
							address: playerAddress,
							x:       0,
							y:       0,
							z:       0,
						}
						playerNo++
						players[playerAddress].name = name
						payload := getStartDirections(players[playerAddress])
						payload = fmt.Appendf(payload, "%s", players[playerAddress].name)
						log.Printf("%d bytes send / %v\n", len(payload), payload)
						_, err = conn.WriteToUDP(payload, clientAddr)
						if err != nil {
							log.Println("Failed to send:", err)
						}
						log.Printf("Welcome %s to the maze", name)
						log.Printf("Start: %s - x: %d, y: %d\n", players[playerAddress].address, players[playerAddress].x, players[playerAddress].y)
					}
				}
			case 2: // walk
				{
					switch buffer[1] {
					case 78: // North
						{
							if players[playerAddress].y-1 >= 0 {
								players[playerAddress].y--
								log.Println("North")
							}
						}
					case 83: // South
						{
							if players[playerAddress].y+1 < mazeDepth {
								players[playerAddress].y++
								log.Println("South")
							}
						}
					case 87: //West
						{
							if players[playerAddress].x-1 >= 0 {
								players[playerAddress].x--
								log.Println("West")
							}
						}
					case 69: //East
						{
							if players[playerAddress].x+1 < mazeWidth {
								players[playerAddress].x++
								log.Println("East")
							}
						}
					case 85: //Up
						{
							if players[playerAddress].z+1 < mazeHeight {
								players[playerAddress].z++
								log.Println("Up")
							}
						}
					case 68: //Down
						{
							if players[playerAddress].z-1 >= 0 {
								players[playerAddress].z--
								log.Println("Down")
							}
						}
					}
					log.Printf("Walk: %s - x: %d, y: %d, z: %d\n", players[playerAddress].address, players[playerAddress].x, players[playerAddress].y, players[playerAddress].z)
					payload := getDirections(players[playerAddress])
					payload[2] = 0
					if checkExit(players[playerAddress]) {
						payload[2] = 2
					}
					if checkStart(players[playerAddress]) {
						payload[2] = 1
					}

					log.Printf("%d bytes send / %v\n", len(payload), payload)
					_, err = conn.WriteToUDP(payload, clientAddr)
					if err != nil {
						log.Println("Failed to send:", err)
					}
				}
			case 3: // exit
				{
					payload := []byte{0xff} //exit
					log.Printf("%d bytes send / %v\n", len(payload), payload)
					_, err = conn.WriteToUDP(payload, clientAddr)
					if err != nil {
						log.Println("Failed to send:", err)
					}
					log.Printf("%s left the maze\n", players[playerAddress].name)
				}
			case 4: // reset to start
				{
					payload := getStartDirections(players[playerAddress])
					payload[2] = 1

					log.Printf("%d bytes send / %v\n", len(payload), payload)
					_, err = conn.WriteToUDP(payload, clientAddr)
					if err != nil {
						log.Println("Failed to send:", err)
					}
					log.Printf("%s reset to start\n", players[playerAddress].name)
				}
			}
		}
	}
}
func checkExit(player *Player) bool {
	cell := maze1[0][player.y][player.x]
	if len(cell) > 1 && cell[2:3] == "2" {
		log.Printf("Congratulations, you have mastered Jester's Maze\n")
		return true
	}
	return false
}
func checkStart(player *Player) bool {

	cell := maze1[0][player.y][player.x]
	if len(cell) > 1 && cell[2:3] == "1" {
		log.Printf("You're on Start again\n")
		return true
	}
	return false
}
func getStartDirections(player *Player) []byte {
	for y, row := range maze1[0] {
		for x, cell := range row {
			if len(cell) > 1 && cell[2:3] == "1" {
				var dir = routeElement[cell[0:2]]
				player.x = x
				player.y = y
				return []byte{dir, 0, 1}
			}
		}
	}
	return nil
}

func getDirections(player *Player) []byte {
	cell := maze1[0][player.y][player.x]
	if len(cell) > 0 {
		log.Printf("%s\n", cell)
		var dir = routeElement[cell[0:2]]
		return []byte{dir, 0, 0}
	}
	return nil
}
