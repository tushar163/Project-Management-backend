import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";


export const register = async (
    req: Request,
    res: Response
) => {
    try {
        const {
            name,
            email,
            password
        } = req.body;
        const exists =
            await prisma.user.findUnique({
                where: { email }
            });
        if (exists) {

            return res.status(400).json({
                message: "User already exists"
            })

        }
        const hash =
            await bcrypt.hash(password, 10);
        const user =
            await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hash
                }

            });
        res.json({
            message: "User Registered successfully",
            data: user,
            status: res.statusCode,
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: error,
            status: res.statusCode,
            success: false
        })
    }
}
export const login = async (
    req: Request,
    res: Response
) => {
    const {
        email,
        password
    } = req.body;
    const user =
        await prisma.user.findUnique({
            where: { email }
        });
    if (!user) {

        return res.status(404).json({
            message: "User not found",
            success: false,
            status: res.statusCode
        })

    }
    const match =
        await bcrypt.compare(
            password,
            user.password
        );
    if (!match) {

        return res.status(401).json({
            message: "Wrong password",
            success: false,
            status: res.statusCode,
        })

    }
    const token =
        jwt.sign(

            {
                id: user.id,
                role: user.role
            },

            process.env.JWT_SECRET!,

            {
                expiresIn: "7d"
            }

        )
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        },
        message: "Login successful",
        status: res.statusCode,
        success: true

    })


}
