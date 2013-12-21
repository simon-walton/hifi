//
//  DatagramSequencer.cpp
//  metavoxels
//
//  Created by Andrzej Kapolka on 12/20/13.
//  Copyright (c) 2013 High Fidelity, Inc. All rights reserved.
//

#include <cstring>

#include "DatagramSequencer.h"

const int MAX_DATAGRAM_SIZE = 1500;

DatagramSequencer::DatagramSequencer() :
    _outgoingPacketStream(&_outgoingPacketData, QIODevice::WriteOnly),
    _outputStream(_outgoingPacketStream),
    _datagramStream(&_datagramBuffer),
    _outgoingPacketNumber(0),
    _outgoingDatagram(MAX_DATAGRAM_SIZE, 0),
    _lastAcknowledgedPacketNumber(0),
    _incomingPacketNumber(0),
    _incomingPacketStream(&_incomingPacketData, QIODevice::ReadOnly),
    _inputStream(_incomingPacketStream),
    _lastReceivedPacketNumber(0) {

    _datagramStream.setByteOrder(QDataStream::LittleEndian);
}

/// Simple RAII-style object to keep a device open when in scope.
class QIODeviceOpener {
public:
    
    QIODeviceOpener(QIODevice* device, QIODevice::OpenMode mode) : _device(device) { _device->open(mode); }
    ~QIODeviceOpener() { _device->close(); }

private:
    
    QIODevice* _device;
};

Bitstream& DatagramSequencer::startPacket() {
    return _outputStream;
}

void DatagramSequencer::endPacket() {
    _outputStream.flush();
    sendPacket(QByteArray::fromRawData(_outgoingPacketData.constData(), _outgoingPacketStream.device()->pos()));
    _outgoingPacketStream.device()->seek(0);
}

void DatagramSequencer::receivedDatagram(const QByteArray& datagram) {
    _datagramBuffer.setBuffer(const_cast<QByteArray*>(&datagram));
    QIODeviceOpener opener(&_datagramBuffer, QIODevice::ReadOnly);
     
    // read the sequence number
    quint32 sequenceNumber;
    _datagramStream >> sequenceNumber;
    
    // if it's less than the last, ignore
    if (sequenceNumber < _incomingPacketNumber) {
        return;
    }
    
    // read the acknowledgement, size and offset
    quint32 acknowledgedPacketNumber, packetSize, offset;
    _datagramStream >> acknowledgedPacketNumber >> packetSize >> offset;
    
    // if it's greater, reset
    if (sequenceNumber > _incomingPacketNumber) {
        _incomingPacketNumber = sequenceNumber;
        _incomingPacketData.resize(packetSize);
        _offsetsReceived.clear();
        _offsetsReceived.insert(offset);
        _remainingBytes = packetSize;
            
        // handle new acknowledgement, if any
        if (_lastAcknowledgedPacketNumber != acknowledgedPacketNumber) {
            packetAcknowledged(_lastAcknowledgedPacketNumber = acknowledgedPacketNumber); 
        }
    } else {
        // make sure it's not a duplicate
        if (_offsetsReceived.contains(offset)) {
            return;
        }
        _offsetsReceived.insert(offset);
    }
    
    // copy in the data
    memcpy(_incomingPacketData.data() + offset, datagram.constData() + _datagramBuffer.pos(), _datagramBuffer.bytesAvailable());
    
    // see if we're done
    if ((_remainingBytes -= _datagramBuffer.bytesAvailable()) == 0) {
        _lastReceivedPacketNumber = _incomingPacketNumber;    
        
        emit readyToRead(_inputStream);
        _incomingPacketStream.device()->seek(0);
        _inputStream.reset();
    }    
}

void DatagramSequencer::sendPacket(const QByteArray& packet) {
    _datagramBuffer.setBuffer(&_outgoingDatagram);
    QIODeviceOpener opener(&_datagramBuffer, QIODevice::WriteOnly);
    
    // increment the packet number
    _outgoingPacketNumber++;
    
    // write the sequence number, acknowledgement, and size, which are the same between all fragments
    _datagramStream << (quint32)_outgoingPacketNumber;
    _datagramStream << (quint32)_lastReceivedPacketNumber;
    _datagramStream << (quint32)packet.size();
    int initialPosition = _datagramBuffer.pos();
    
    // break the packet into MTU-sized datagrams
    int offset = 0;
    do {
        _datagramBuffer.seek(initialPosition);
        _datagramStream << (quint32)offset;
        
        int payloadSize = qMin((int)(_outgoingDatagram.size() - _datagramBuffer.pos()), packet.size() - offset);
        memcpy(_outgoingDatagram.data() + _datagramBuffer.pos(), packet.constData() + offset, payloadSize);
        
        emit readyToWrite(QByteArray::fromRawData(_outgoingDatagram.constData(), _datagramBuffer.pos() + payloadSize));
        
        offset += payloadSize;
        
    } while(offset < packet.size());
}

void DatagramSequencer::packetAcknowledged(int packetNumber) {
    
}
