import { Construct } from 'constructs';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group/index.js';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network/index.js';
import { NetworkSecurityGroup } from '@cdktf/provider-azurerm/lib/network-security-group/index.js';
import { PublicIp } from '@cdktf/provider-azurerm/lib/public-ip/index.js';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet/index.js';
import { NetworkSecurityRule } from '@cdktf/provider-azurerm/lib/network-security-rule/index.js';
import { SubnetNetworkSecurityGroupAssociation } from '@cdktf/provider-azurerm/lib/subnet-network-security-group-association/index.js';

class SimpleVNet extends Construct {
  private rg: ResourceGroup;

  private tags: { [key: string]: string };

  public vNet: VirtualNetwork;

  public networkSecurityGroup: NetworkSecurityGroup;

  public pip!: PublicIp;

  public subnet: Subnet;

  constructor(scope: Construct, name: string, options: {
    resourceGroup: ResourceGroup,
    vNetName: string,
    vNetAddressSpace: string[],
    subnetAddressPrefixes: string[],
    tags: {
      [key: string]: string;
    },

  }) {
    super(scope, name);
    this.rg = options.resourceGroup;
    this.tags = options.tags;

    this.vNet = new VirtualNetwork(
      this,
      options.vNetName,
      // 'myVirtualNetwork',
      {
        // addressSpace: ['10.123.0.0/16'],
        addressSpace: options.vNetAddressSpace,
        location: this.rg.location,
        // name: 'mtc-network',
        name: options.vNetName,
        resourceGroupName: this.rg.name,
        tags: options.tags,
      },
    );

    this.networkSecurityGroup = new NetworkSecurityGroup(this, 'mtc-sg', {
      location: this.rg.location,
      name: 'mtc-sg',
      resourceGroupName: this.rg.name,
      tags: options.tags,
    });

    new NetworkSecurityRule(this, 'mtc-dev-rule', {
      access: 'Allow',
      destinationAddressPrefix: '*',
      destinationPortRange: '*',
      direction: 'Inbound',
      name: 'mtc-dev-rule',
      networkSecurityGroupName: this.networkSecurityGroup.name,
      priority: 100,
      protocol: '*',
      resourceGroupName: this.rg.name,
      sourceAddressPrefix: '*',
      sourcePortRange: '*',
    });

    this.subnet = new Subnet(this, 'mtc-subnet', {
      // addressPrefixes: ['10.123.1.0/24'],
      addressPrefixes: options.subnetAddressPrefixes,
      name: 'mtc-subnet',
      resourceGroupName: this.rg.name,
      virtualNetworkName: this.vNet.name,
    });

    new SubnetNetworkSecurityGroupAssociation(
      this,
      'mtc-sga',
      {
        networkSecurityGroupId: this.networkSecurityGroup.id,
        subnetId: this.subnet.id,
      },
    );
  }

  addPublicIp() {
    this.pip = new PublicIp(this, 'myPublicIp', {
      allocationMethod: 'Dynamic',
      location: this.rg.location,
      name: 'mtc-ip',
      resourceGroupName: this.rg.name,
      tags: this.tags,
    });
  }
}

export default SimpleVNet;
