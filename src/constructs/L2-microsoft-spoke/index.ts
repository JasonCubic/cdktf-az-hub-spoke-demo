import { NetworkInterface } from '@cdktf/provider-azurerm/lib/network-interface/index.js';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet/index.js';
import { VirtualMachine } from '@cdktf/provider-azurerm/lib/virtual-machine/index.js';
import { VirtualNetworkGateway } from '@cdktf/provider-azurerm/lib/virtual-network-gateway/index.js';
import { VirtualNetworkPeering } from '@cdktf/provider-azurerm/lib/virtual-network-peering/index.js';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network/index.js';
import { Construct } from 'constructs';

// Original: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-spoke-network

class MicrosoftSpoke extends Construct {
  public mgmtSubnet: Subnet;

  public workloadSubnet: Subnet;

  public prefixSpoke: string;

  public spokeVnet: VirtualNetwork;

  constructor(scope: Construct, name: string, options: {
    prefixSpoke: string,
    spokeLocation: string,
    hubVNet: VirtualNetwork,
    hubVNetGateway: VirtualNetworkGateway,
    spokeVnetAddressSpace: string[],
    subnetSpokeMgmtAddressPrefixes: string[],
    subnetSpokeWorkloadAddressPrefixes: string[],
    adminUsername: string,
    adminPassword: string,
  }) {
    super(scope, name);
    this.prefixSpoke = options.prefixSpoke;

    const spokeVnetRg = new ResourceGroup(this, `${this.prefixSpoke}-vnet-rg`, {
      location: options.spokeLocation,
      name: `${this.prefixSpoke}-vnet-rg`,
    });

    this.spokeVnet = new VirtualNetwork(this, `${this.prefixSpoke}-vnet`, {
      addressSpace: options.spokeVnetAddressSpace,
      location: spokeVnetRg.location,
      name: `${this.prefixSpoke}-vnet`,
      resourceGroupName: spokeVnetRg.name,
      tags: {
        environment: this.prefixSpoke,
      },
    });

    new VirtualNetworkPeering(this, `${this.prefixSpoke}-hub-spoke-peer`, {
      allowForwardedTraffic: true,
      allowGatewayTransit: true,
      allowVirtualNetworkAccess: true,
      dependsOn: [
        this.spokeVnet,
        options.hubVNet,
        options.hubVNetGateway,
      ],
      name: `${this.prefixSpoke}-hub-spoke-peer`,
      remoteVirtualNetworkId: this.spokeVnet.id,
      resourceGroupName: options.hubVNet.resourceGroupName,
      useRemoteGateways: false,
      virtualNetworkName: options.hubVNet.name,
    });

    new VirtualNetworkPeering(this, `${this.prefixSpoke}-spoke-hub-peer`, {
      allowForwardedTraffic: true,
      allowGatewayTransit: false,
      allowVirtualNetworkAccess: true,
      dependsOn: [
        this.spokeVnet,
        options.hubVNet,
        options.hubVNetGateway,
      ],
      name: `${this.prefixSpoke}-spoke-hub-peer`,
      remoteVirtualNetworkId: options.hubVNet.id,
      resourceGroupName: spokeVnetRg.name,
      useRemoteGateways: true,
      virtualNetworkName: this.spokeVnet.name,
    });

    this.mgmtSubnet = new Subnet(this, `${this.prefixSpoke}-mgmt`, {
      addressPrefixes: options.subnetSpokeMgmtAddressPrefixes,
      name: 'mgmt',
      resourceGroupName: spokeVnetRg.name,
      virtualNetworkName: this.spokeVnet.name,
    });

    this.workloadSubnet = new Subnet(this, `${this.prefixSpoke}-workload`, {
      addressPrefixes: options.subnetSpokeWorkloadAddressPrefixes,
      name: 'workload',
      resourceGroupName: spokeVnetRg.name,
      virtualNetworkName: this.spokeVnet.name,
    });

    const spokeNic = new NetworkInterface(this, `${this.prefixSpoke}-nic`, {
      name: `${this.prefixSpoke}-nic`,
      location: spokeVnetRg.location,
      resourceGroupName: spokeVnetRg.name,
      enableIpForwarding: true,
      ipConfiguration: [
        {
          name: this.prefixSpoke,
          privateIpAddressAllocation: 'Dynamic',
          subnetId: this.mgmtSubnet.id,
        },
      ],
      tags: {
        environment: this.prefixSpoke,
      },
    });

    new VirtualMachine(this, `${this.prefixSpoke}-vm`, {
      name: `${this.prefixSpoke}-vm`,
      location: spokeVnetRg.location,
      resourceGroupName: spokeVnetRg.name,
      networkInterfaceIds: [spokeNic.id],
      osProfile: {
        adminUsername: options.adminUsername,
        adminPassword: options.adminPassword,
        computerName: `${this.prefixSpoke}-vm`,
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
        name: `${this.prefixSpoke}-vm-os-disk-1`,
        caching: 'ReadWrite',
        createOption: 'FromImage',
        managedDiskType: 'Standard_LRS',
      },
      deleteOsDiskOnTermination: true,
      tags: {
        environment: this.prefixSpoke,
      },
      vmSize: 'Standard_B1s',
    });
  }
}

export default MicrosoftSpoke;
