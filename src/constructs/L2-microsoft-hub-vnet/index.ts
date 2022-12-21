import { Construct } from 'constructs';
import { PublicIp } from '@cdktf/provider-azurerm/lib/public-ip/index.js';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet/index.js';
import { VirtualNetworkGatewayConnection } from '@cdktf/provider-azurerm/lib/virtual-network-gateway-connection/index.js';
import { VirtualNetworkGateway } from '@cdktf/provider-azurerm/lib/virtual-network-gateway/index.js';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network/index.js';
import { NetworkInterface } from '@cdktf/provider-azurerm/lib/network-interface/index.js';
import { VirtualMachine } from '@cdktf/provider-azurerm/lib/virtual-machine/index.js';

// Original: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-hub-network

class MicrosoftHubVNet extends Construct {
  public hubGatewaySubnet: Subnet;

  public hubDmzSubnet: Subnet;

  public hubVnet: VirtualNetwork;

  public hubVnetGateway: VirtualNetworkGateway;

  constructor(scope: Construct, name: string, options: {
    hubLocation: string,
    prefixHub: string,
    sharedKey: string,
    onPremVpnGateway: VirtualNetworkGateway,
    onPremVNetRg: ResourceGroup,
    adminUsername: string,
    adminPassword: string,
  }) {
    super(scope, name);

    const hubVnetRg = new ResourceGroup(this, `${options.prefixHub}-rg`, {
      location: options.hubLocation,
      name: `${options.prefixHub}-rg`,
    });

    this.hubVnet = new VirtualNetwork(this, `${options.prefixHub}-vnet`, {
      name: `${options.prefixHub}-vnet`,
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,
      addressSpace: ['10.0.0.0/16'],
      tags: {
        environment: 'hub-spoke',
      },
    });

    const hubVpnGatewayPip = new PublicIp(this, 'hub-vpn-gateway-pip', {
      name: 'hub-vpn-gateway-pip',
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,
      allocationMethod: 'Dynamic',
    });

    this.hubDmzSubnet = new Subnet(this, 'hub-dmz', {
      name: 'dmz',
      resourceGroupName: hubVnetRg.name,
      addressPrefixes: ['10.0.0.32/27'],
      virtualNetworkName: this.hubVnet.name,
    });

    this.hubGatewaySubnet = new Subnet(this, 'hub-gateway-subnet', {
      name: 'GatewaySubnet',
      resourceGroupName: hubVnetRg.name,
      addressPrefixes: ['10.0.255.224/27'],
      virtualNetworkName: this.hubVnet.name,
    });

    const subnetHubMgmt = new Subnet(this, 'hub-mgmt', {
      name: 'mgmt',
      resourceGroupName: hubVnetRg.name,
      virtualNetworkName: this.hubVnet.name,
      addressPrefixes: ['10.0.0.64/27'],
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_gateway
    this.hubVnetGateway = new VirtualNetworkGateway(this, 'hub-vpn-gateway', {
      name: 'hub-vpn-gateway',
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,

      type: 'Vpn',
      vpnType: 'RouteBased',

      activeActive: false,
      enableBgp: false,
      sku: 'VpnGw1',

      ipConfiguration: [
        {
          name: 'vnetGatewayConfig',
          privateIpAddressAllocation: 'Dynamic',
          publicIpAddressId: hubVpnGatewayPip.id,
          subnetId: this.hubGatewaySubnet.id,
        },
      ],

      timeouts: { // this VirtualNetworkGateway takes more than 60 minutes to deploy
        create: '90m',
        update: '90m',
        delete: '90m',
      },
      dependsOn: [hubVpnGatewayPip],
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_gateway_connection
    new VirtualNetworkGatewayConnection(this, 'hub-to-onPrem-conn', {
      name: 'hub-to-onPrem-conn',
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,

      type: 'Vnet2Vnet',
      virtualNetworkGatewayId: this.hubVnetGateway.id,
      peerVirtualNetworkGatewayId: options.onPremVpnGateway.id,
      routingWeight: 1,
      sharedKey: options.sharedKey,
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_gateway_connection
    new VirtualNetworkGatewayConnection(this, 'onPrem-to-hub-conn', {
      name: 'onPrem-to-hub-conn',
      location: options.onPremVNetRg.location,
      resourceGroupName: options.onPremVNetRg.name,

      type: 'Vnet2Vnet',
      virtualNetworkGatewayId: options.onPremVpnGateway.id,
      peerVirtualNetworkGatewayId: this.hubVnetGateway.id,
      routingWeight: 1,
      sharedKey: options.sharedKey,
    });

    const hubNic = new NetworkInterface(this, 'hub-nic', {
      name: `${options.prefixHub}-nic`,
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,
      enableIpForwarding: true,
      ipConfiguration: [
        {
          name: `${options.prefixHub}-nic-ip-config`,
          // name: 'hub',
          privateIpAddressAllocation: 'Dynamic',
          subnetId: subnetHubMgmt.id,
        },
      ],
      tags: {
        environment: options.prefixHub,
      },
    });

    new VirtualMachine(this, `${options.prefixHub}-vm`, {
      name: `${options.prefixHub}-vm`,
      location: hubVnetRg.location,
      resourceGroupName: hubVnetRg.name,
      networkInterfaceIds: [hubNic.id],
      osProfile: {
        adminUsername: options.adminUsername,
        adminPassword: options.adminPassword,
        computerName: `${options.prefixHub}-vm`,
      },
      osProfileLinuxConfig: {
        disablePasswordAuthentication: false,
      },
      storageImageReference: {
        offer: 'UbuntuServer',
        publisher: 'Canonical',
        sku: '16.04-LTS',
        version: 'latest',
      },
      storageOsDisk: {
        name: `${options.prefixHub}-vm-os-disk-1`,
        caching: 'ReadWrite',
        createOption: 'FromImage',
        managedDiskType: 'Standard_LRS',
      },
      deleteOsDiskOnTermination: true,
      tags: {
        environment: options.prefixHub,
      },
      vmSize: 'Standard_B1s',
    });
  }
}

export default MicrosoftHubVNet;
