import { TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network/index.js';
import { NetworkSecurityGroup } from '@cdktf/provider-azurerm/lib/network-security-group/index.js';
import { PublicIp } from '@cdktf/provider-azurerm/lib/public-ip/index.js';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet/index.js';
import { SubnetNetworkSecurityGroupAssociation } from '@cdktf/provider-azurerm/lib/subnet-network-security-group-association/index.js';
import { VirtualNetworkGateway } from '@cdktf/provider-azurerm/lib/virtual-network-gateway/index.js';
import { NetworkInterface } from '@cdktf/provider-azurerm/lib/network-interface/index.js';
import { NetworkSecurityRule } from '@cdktf/provider-azurerm/lib/network-security-rule/index.js';
import { VirtualMachine } from '@cdktf/provider-azurerm/lib/virtual-machine/index.js';
import { DataAzurermPublicIp } from '@cdktf/provider-azurerm/lib/data-azurerm-public-ip/index.js';

// Original: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-on-prem

class MockOnPrem extends Construct {
  public onPremVpnGateway: VirtualNetworkGateway;

  public onPremVnetRg: ResourceGroup;

  constructor(scope: Construct, name: string, options: {
    onPremLocation: string,
    prefixOnPrem: string,
    adminUsername: string,
    adminPassword: string,
  }) {
    super(scope, name);

    this.onPremVnetRg = new ResourceGroup(this, `${options.prefixOnPrem}-vnet-rg`, {
      location: options.onPremLocation,
      name: `${options.prefixOnPrem}-vnet-rg`,
    });

    const onPremVnet = new VirtualNetwork(this, `${options.prefixOnPrem}-vnet`, {
      name: `${options.prefixOnPrem}-vnet`,
      location: this.onPremVnetRg.location,
      addressSpace: ['192.168.0.0/16'],
      resourceGroupName: this.onPremVnetRg.name,
      tags: {
        environment: options.prefixOnPrem,
      },
    });

    const onPremNsg = new NetworkSecurityGroup(this, `${options.prefixOnPrem}-nsg`, {
      location: this.onPremVnetRg.location,
      name: `${options.prefixOnPrem}-nsg`,
      resourceGroupName: this.onPremVnetRg.name,
      tags: {
        environment: options.prefixOnPrem,
      },
    });

    new NetworkSecurityRule(this, `${options.prefixOnPrem}-nsg-rule`, {
      name: `${options.prefixOnPrem}-nsg-rule`,
      resourceGroupName: this.onPremVnetRg.name,
      networkSecurityGroupName: onPremNsg.name,
      priority: 100,
      direction: 'Inbound',
      access: 'Allow',
      protocol: 'Tcp',
      destinationAddressPrefix: '*',
      destinationPortRange: '22',
      sourceAddressPrefix: '*',
      sourcePortRange: '*',
    });

    const onPremPip = new PublicIp(this, `${options.prefixOnPrem}-pip`, {
      allocationMethod: 'Dynamic',
      location: this.onPremVnetRg.location,
      name: `${options.prefixOnPrem}-pip`,
      resourceGroupName: this.onPremVnetRg.name,
      tags: {
        environment: options.prefixOnPrem,
      },
    });

    const onPremVpnGatewayPip = new PublicIp(this, 'onPrem-vpn-gateway-pip', {
      name: `${options.prefixOnPrem}-vpn-gateway-pip`,
      location: this.onPremVnetRg.location,
      resourceGroupName: this.onPremVnetRg.name,
      allocationMethod: 'Dynamic',
    });

    const onPremGatewaySubnet = new Subnet(this, 'onPrem-gateway-subnet', {
      name: 'GatewaySubnet',
      addressPrefixes: ['192.168.255.224/27'],
      resourceGroupName: this.onPremVnetRg.name,
      virtualNetworkName: onPremVnet.name,
    });

    const onPremMgmtSubnet = new Subnet(this, `${options.prefixOnPrem}-mgmt`, {
      name: `${options.prefixOnPrem}-mgmt`,
      addressPrefixes: ['192.168.1.128/25'],
      resourceGroupName: this.onPremVnetRg.name,
      virtualNetworkName: onPremVnet.name,
    });

    new SubnetNetworkSecurityGroupAssociation(this, `${options.prefixOnPrem}-mgmt-nsg-association`, {
      networkSecurityGroupId: onPremNsg.id,
      subnetId: onPremMgmtSubnet.id,
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_gateway
    this.onPremVpnGateway = new VirtualNetworkGateway(this, `${options.prefixOnPrem}-vpn-gateway`, {
      name: `${options.prefixOnPrem}-vpn-gateway`,
      location: this.onPremVnetRg.location,
      resourceGroupName: this.onPremVnetRg.name,

      type: 'Vpn',
      vpnType: 'RouteBased',

      activeActive: false,
      enableBgp: false,
      sku: 'VpnGw1',

      ipConfiguration: [
        {
          name: 'vnetGatewayConfig',
          publicIpAddressId: onPremVpnGatewayPip.id,
          privateIpAddressAllocation: 'Dynamic',
          subnetId: onPremGatewaySubnet.id,
        },
      ],

      timeouts: { // this VirtualNetworkGateway takes more than 60 minutes to deploy
        create: '90m',
        update: '90m',
        delete: '90m',
      },
      dependsOn: [onPremVpnGatewayPip],
    });

    const onPremNic = new NetworkInterface(this, `${options.prefixOnPrem}-nic`, {
      name: `${options.prefixOnPrem}-nic`,
      location: this.onPremVnetRg.location,
      resourceGroupName: this.onPremVnetRg.name,
      enableIpForwarding: true,

      ipConfiguration: [
        {
          name: `${options.prefixOnPrem}-nic-ip-config`,
          subnetId: onPremMgmtSubnet.id,
          privateIpAddressAllocation: 'Dynamic',
          publicIpAddressId: onPremPip.id,
        },
      ],
    });

    const onPremVm = new VirtualMachine(this, `${options.prefixOnPrem}-vm`, {
      name: `${options.prefixOnPrem}-vm`,
      location: this.onPremVnetRg.location,
      resourceGroupName: this.onPremVnetRg.name,
      networkInterfaceIds: [onPremNic.id],
      osProfile: {
        adminUsername: options.adminUsername,
        adminPassword: options.adminPassword,
        computerName: `${options.prefixOnPrem}-vm`,
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
        name: `${options.prefixOnPrem}-os-disk-1`,
        caching: 'ReadWrite',
        createOption: 'FromImage',
        managedDiskType: 'Standard_LRS',
      },
      deleteOsDiskOnTermination: true,
      tags: {
        environment: options.prefixOnPrem,
      },
      vmSize: 'Standard_B1s',
    });

    const onPremVmPipData = new DataAzurermPublicIp(this, `${options.prefixOnPrem}-vm-public-ip-data`, {
      name: onPremPip.name, // this has to match the public ip resource's name
      resourceGroupName: this.onPremVnetRg.name,
      dependsOn: [onPremVm],
    });

    new TerraformOutput(this, 'public_ip_address', {
      value: `${onPremVmPipData.name}: ${onPremVmPipData.ipAddress}`,
    });
  }
}

export default MockOnPrem;
