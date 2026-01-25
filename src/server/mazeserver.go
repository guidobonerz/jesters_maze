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
	{"X", "L3", "X", "X", "X", "X", "X", "X", "A2", "X", "X", "D", "B", "B", "B", "B", "E", "N3", "E", "X"},
	{"X", "F", "B", "I", "B", "B", "B", "O", "F", "B", "B", "G", "X", "D", "B", "E", "F", "E", "A", "X"},
	{"X", "L4", "X", "F", "E", "X", "D", "B", "I", "B", "E", "X", "L4", "F", "E", "A", "X", "A", "A", "X"},
	{"X", "K", "B", "B", "H", "B", "G", "X", "A", "D", "G", "X", "K", "B", "G", "A", "X", "A", "A", "X"},
	{"X", "A63", "X", "X", "N", "B", "B", "E", "A", "F", "B", "B", "G", "X", "X", "F", "B", "G", "A", "X"},
	{"X", "A", "D", "B", "B", "B", "E", "F", "H", "E", "D", "O3", "X", "N", "B", "B", "B", "E", "A", "X"},
	{"X", "F", "G", "X", "D", "B", "G", "X", "X", "F", "G", "X", "D", "I", "B", "B", "E", "F", "H", "E"},
	{"X", "A", "X", "L3", "A", "X", "X", "X", "D", "O", "D", "E", "A62", "A", "X", "X", "A", "X", "D", "G"},
	{"X", "A", "X", "A", "F", "B", "B", "I", "E", "X", "A", "F", "G", "F", "B", "E", "A", "D", "G", "X"},
	{"D", "H", "B", "H", "B", "E", "L", "M4", "A", "D", "G", "X", "D", "B", "B", "G", "A", "K", "B", "E"},
	{"F", "E", "X", "X", "X", "K", "G", "X", "F", "G", "X", "X", "M52", "X", "D", "E", "A", "F", "E", "M"},
	{"X", "M", "D", "B", "I", "H", "B", "B", "O", "X", "D", "I", "B", "B64", "G", "A", "A", "X", "A", "X"},
	{"X", "D", "G", "X", "M", "X", "X", "X", "X", "X", "A", "A", "X", "X", "D", "G", "A", "N4", "J", "X"},
	{"N4", "J", "X", "L", "X", "D", "B61", "B", "E", "X", "A", "F", "E", "X", "F", "B", "G", "X", "A", "X"},
	{"X", "A", "D", "H", "B", "G", "X", "X", "A", "X", "K", "O4", "A", "X", "X", "X", "D", "B", "G", "X"},
	{"X", "A", "A", "X", "D", "O51", "L", "X", "F", "B", "G", "X", "K", "O4", "D", "E", "F", "I", "E", "X"},
	{"D", "G", "K", "B", "G", "X", "F", "B", "I", "E", "D", "B", "J", "D", "G", "A", "X", "A", "M", "X"},
	{"F", "E", "A", "D", "B", "B", "B", "E", "A", "F", "G", "D", "H", "J", "X", "F", "I", "G", "X", "X"},
	{"X", "A", "F", "G", "X", "D", "B", "G", "F", "B", "B", "G", "X", "M54", "X", "X", "F", "O3", "X", "X"},
	{"X", "F", "B", "O53", "X", "A1", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X"}}}

var players = make(map[string]*Player)

func setupRouteElements() {
	//                        SOWN
	routeElement["A"] = 0b00001001
	routeElement["B"] = 0b00000110
	routeElement["C"] = 0b00001111
	routeElement["D"] = 0b00001100
	routeElement["E"] = 0b00001010
	routeElement["F"] = 0b00000101
	routeElement["G"] = 0b00000011
	routeElement["H"] = 0b00000111
	routeElement["I"] = 0b00001110
	routeElement["J"] = 0b00001011
	routeElement["K"] = 0b00001101
	routeElement["L"] = 0b00001000
	routeElement["M"] = 0b00000001
	routeElement["N"] = 0b00000100
	routeElement["O"] = 0b00000010
	routeElement["X"] = 0b00000000
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
							//log.Printf("%s climbs up, floor: %d\n", players[playerAddress].name, players[playerAddress].z)
						}
					case 68: //Down
						{
							if players[playerAddress].z-1 >= 0 {
								players[playerAddress].z--
								log.Println("Down")
							}
							//log.Printf("%s climbs down, floor: %d\n", players[playerAddress].name, players[playerAddress].z)
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
	cell := maze1[0][player.x][player.y]
	if len(cell) > 1 && cell[1:2] == "2" {
		log.Printf("Congratulations, you have mastered Jester's Maze\n")
		return true
	}
	return false
}
func checkStart(player *Player) bool {

	cell := maze1[0][player.y][player.x]
	if len(cell) > 1 && cell[1:2] == "1" {
		log.Printf("You're on Start again\n")
		return true
	}
	return false
}
func getStartDirections(player *Player) []byte {
	for y, row := range maze1[0] {
		for x, cell := range row {
			if len(cell) > 1 && cell[1:2] == "1" {
				var dir = routeElement[cell[0:1]]
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
		var dir = routeElement[cell[0:1]]
		//	currentX = x
		//	currentY = y
		return []byte{dir, 0, 0}
	}
	return nil
}
