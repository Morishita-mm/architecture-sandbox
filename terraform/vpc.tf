# 1. インターネットゲートウェイ (VPCの玄関)
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# 2. ルートテーブル (道案内)
# "0.0.0.0/0" (インターネット全体) への通信は igw へ行け、というルール
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# 3. ルートテーブルの紐付け
# 既存のサブネット (aws_subnet.private) を、この新しいルートテーブルに紐付けます
# これにより、実質的に "パブリックサブネット" に変わります
resource "aws_route_table_association" "public_assoc" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.public_rt.id
}