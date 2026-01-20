package main

import (
	"fmt"
	"log"
	"net"
	"os"
)

var port = 64646
var currentX = 0
var currentY = 0
var mazeWidth = 20
var mazeHeight = 20
var routeElement = make(map[string]byte)
var maze1 = [][]string{
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
	{"X", "F", "B", "O53", "X", "A1", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X"}}

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
	buffer := make([]byte, 10)
	for {
		byteCount, clientAddr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			log.Println("Failed to receive:", err)
			continue
		}

		log.Printf("%d bytes received / %v\n", byteCount, buffer)
		if byteCount > 0 {
			switch buffer[0] {
			case 1:
				{
					log.Println("Start")
					payload := getStartDirections()
					log.Printf("%d bytes send / %v\n", len(payload), payload)
					_, err = conn.WriteToUDP(payload, clientAddr)
					if err != nil {
						log.Println("Failed to send:", err)
					}
				}
			case 2:
				{
					log.Println("Walk")
					switch buffer[1] {
					case 78: // North
						{
							if currentY-1 >= 0 {
								currentY--
							}
						}
					case 83: // South
						{
							if currentY+1 < mazeHeight {
								currentY++
							}
						}
					case 87: //West
						{
							if currentX-1 >= 0 {
								currentX--
							}
						}
					case 69: //East
						{
							if currentX+1 < mazeWidth {
								currentX++
							}
						}
					}
					log.Printf("x: %d, y: %d\n", currentX, currentY)
					payload := getDirections(currentX, currentY)
					payload[2] = 0
					if checkExit(currentX, currentY) {
						payload[2] = 2
					}
					if checkStart(currentX, currentY) {
						payload[2] = 1
					}

					log.Printf("%d bytes send / %v\n", len(payload), payload)
					_, err = conn.WriteToUDP(payload, clientAddr)
					if err != nil {
						log.Println("Failed to send:", err)
					}
				}
			}
		}
	}
}
func checkExit(x int, y int) bool {
	cell := maze1[y][x]
	if len(cell) > 1 && cell[1:2] == "2" {
		log.Printf("Congratulations, you have mastered Jester's Maze\n")
		return true
	}
	return false
}
func checkStart(x int, y int) bool {

	cell := maze1[y][x]
	if len(cell) > 1 && cell[1:2] == "1" {
		log.Printf("You're on Start again\n")
		return true
	}
	return false
}
func getStartDirections() []byte {
	for y, row := range maze1 {
		for x, cell := range row {
			if len(cell) > 1 && cell[1:2] == "1" {
				var dir = routeElement[cell[0:1]]
				currentX = x
				currentY = y
				log.Printf("x: %d, y: %d\n", currentX, currentY)
				return []byte{dir, 0, 1}
			}
		}
	}
	return nil
}

func getDirections(x int, y int) []byte {
	cell := maze1[y][x]
	if len(cell) > 0 {
		log.Printf("%s\n", cell)
		var dir = routeElement[cell[0:1]]
		currentX = x
		currentY = y
		return []byte{dir, 0, 0}
	}
	return nil
}
